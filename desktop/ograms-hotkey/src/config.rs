//! User configuration + secret storage for the desktop app.
//!
//! Settings live in `%APPDATA%\OGrammar\config.json` (plain). The provider API
//! key is stored separately in `%APPDATA%\OGrammar\apikey.bin`, encrypted with
//! Windows DPAPI (CryptProtectData) so it is bound to the user account and never
//! written in plaintext — mirroring the extension's encrypt-at-rest key store.
//! For dev/testing the key can also come from the `OG_LLM_KEY` env var.

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use ograms_engine::DialectName;
use ograms_engine::llm::{DEFAULT_TIMEOUT_MS, LlmConfig};
use serde::{Deserialize, Serialize};

use windows::Win32::Foundation::{HLOCAL, LocalFree};
use windows::Win32::Security::Cryptography::{
    CRYPT_INTEGER_BLOB, CryptProtectData, CryptUnprotectData,
};
use windows::Win32::System::Registry::{
    HKEY, HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE, REG_SZ, RegCloseKey, RegDeleteValueW,
    RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
};
use windows::core::w;

/// Set by the settings window on Save; the monitor reloads config on next poll.
pub static RELOAD_REQUESTED: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    /// Master on/off — when false the monitor draws nothing.
    pub enabled: bool,
    /// Proactive LLM ("context checking") tier on/off.
    pub llm_enabled: bool,
    /// Autocorrect: auto-apply high-confidence fixes (capitalization, small
    /// typos) as you type. Off by default — opt-in, since it edits silently.
    pub autocorrect_enabled: bool,
    /// Idle time (ms) after the last keystroke before autocorrect applies.
    /// User-configurable; longer = more deliberate, never fires mid-typing.
    pub autocorrect_delay_ms: u64,
    pub provider: String,
    pub model: String,
    pub custom_base_url: String,
    pub ollama_url: String,
    pub harper_dialect: String,
    /// Process image names (lowercase, e.g. "chrome.exe") the desktop must NOT
    /// touch — browsers (extension owns them) + any sensitive apps.
    pub excluded_apps: Vec<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            enabled: true,
            llm_enabled: true,
            autocorrect_enabled: false,
            autocorrect_delay_ms: 3000,
            provider: "openai".to_string(),
            model: "gpt-4o-mini".to_string(),
            custom_base_url: String::new(),
            ollama_url: "http://localhost:11434".to_string(),
            harper_dialect: "American".to_string(),
            excluded_apps: default_excluded_apps(),
        }
    }
}

/// Browsers where the OGrammar extension already runs — the desktop yields these
/// surfaces so the two never double-underline the same field.
pub fn default_excluded_apps() -> Vec<String> {
    [
        "chrome.exe",
        "msedge.exe",
        "firefox.exe",
        "brave.exe",
        "opera.exe",
        "vivaldi.exe",
        "arc.exe",
        "iexplore.exe",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

impl Config {
    pub fn load() -> Self {
        let path = config_path();
        let Ok(bytes) = fs::read(&path) else {
            return Self::default();
        };
        // Tolerate a UTF-8 BOM (editors / PowerShell `Set-Content -Encoding utf8`
        // prepend one, which serde_json would otherwise reject → silent default).
        let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&bytes);
        match serde_json::from_slice(bytes) {
            Ok(cfg) => cfg,
            Err(error) => {
                eprintln!("config.json parse failed ({error}); using defaults");
                Self::default()
            }
        }
    }

    pub fn save(&self) -> std::io::Result<()> {
        let dir = config_dir();
        fs::create_dir_all(&dir)?;
        let json = serde_json::to_string_pretty(self).unwrap_or_default();
        fs::write(config_path(), json)
    }

    pub fn dialect(&self) -> DialectName {
        match self.harper_dialect.to_ascii_lowercase().as_str() {
            "british" => DialectName::British,
            "canadian" => DialectName::Canadian,
            "australian" => DialectName::Australian,
            _ => DialectName::American,
        }
    }

    /// Idle time after the last keystroke before autocorrect applies. Clamped to
    /// a sane range so a bad config value can't disable or spam autocorrect.
    pub fn autocorrect_delay(&self) -> Duration {
        Duration::from_millis(self.autocorrect_delay_ms.clamp(500, 10_000))
    }

    /// Resolved OpenAI-compatible base URL for the selected provider.
    pub fn resolve_base_url(&self) -> String {
        match self.provider.as_str() {
            "deepseek" => "https://api.deepseek.com/v1".to_string(),
            "openrouter" => "https://openrouter.ai/api/v1".to_string(),
            "groq" => "https://api.groq.com/openai/v1".to_string(),
            "together" => "https://api.together.xyz/v1".to_string(),
            "abacus" => "https://routellm.abacus.ai/v1".to_string(),
            "ollama" => {
                let b = self.ollama_url.trim_end_matches('/');
                if b.ends_with("/v1") {
                    b.to_string()
                } else {
                    format!("{b}/v1")
                }
            }
            "custom" => self.custom_base_url.clone(),
            _ => "https://api.openai.com/v1".to_string(),
        }
    }

    /// Build the engine LLM transport config, pulling the key from DPAPI/env.
    /// Returns None when the LLM tier can't run (disabled, or no key for a
    /// provider that needs one).
    pub fn llm_config(&self) -> Option<LlmConfig> {
        if !self.enabled || !self.llm_enabled {
            return None;
        }
        let api_key = load_api_key();
        if api_key.is_empty() && self.provider != "ollama" {
            return None;
        }
        Some(LlmConfig {
            base_url: self.resolve_base_url(),
            api_key,
            model: self.model.clone(),
            timeout_ms: DEFAULT_TIMEOUT_MS,
        })
    }

    /// True if the given process image name is on the exclusion list.
    pub fn is_app_excluded(&self, image_name: &str) -> bool {
        let needle = image_name.to_ascii_lowercase();
        self.excluded_apps
            .iter()
            .any(|app| app.eq_ignore_ascii_case(&needle))
    }
}

pub fn config_dir() -> PathBuf {
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(base).join("OGrammar")
}

pub fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

fn api_key_path() -> PathBuf {
    config_dir().join("apikey.bin")
}

/// True if "start at logon" is registered under HKCU\…\Run.
pub fn is_autostart() -> bool {
    unsafe {
        let mut hkey = HKEY::default();
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            w!(r"Software\Microsoft\Windows\CurrentVersion\Run"),
            Some(0),
            KEY_READ,
            &mut hkey,
        )
        .0 != 0
        {
            return false;
        }
        let result = RegQueryValueExW(hkey, w!("OGrammar"), None, None, None, None);
        let _ = RegCloseKey(hkey);
        result.0 == 0
    }
}

/// Register/unregister "start at logon" (per-user HKCU Run; no admin needed).
pub fn set_autostart(enabled: bool) -> bool {
    unsafe {
        let mut hkey = HKEY::default();
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            w!(r"Software\Microsoft\Windows\CurrentVersion\Run"),
            Some(0),
            KEY_SET_VALUE,
            &mut hkey,
        )
        .0 != 0
        {
            return false;
        }
        let ok = if enabled {
            let exe = std::env::current_exe().unwrap_or_default();
            // Quote the path and pass --quiet so logon start is silent.
            let cmd = format!("\"{}\" --quiet", exe.to_string_lossy());
            let mut wide: Vec<u16> = cmd.encode_utf16().collect();
            wide.push(0);
            let bytes =
                std::slice::from_raw_parts(wide.as_ptr() as *const u8, std::mem::size_of_val(&wide[..]));
            RegSetValueExW(hkey, w!("OGrammar"), Some(0), REG_SZ, Some(bytes)).0 == 0
        } else {
            let _ = RegDeleteValueW(hkey, w!("OGrammar"));
            true
        };
        let _ = RegCloseKey(hkey);
        ok
    }
}

/// Load the API key: DPAPI-decrypted file first, then `OG_LLM_KEY` env fallback.
pub fn load_api_key() -> String {
    if let Ok(enc) = fs::read(api_key_path()) {
        if let Some(plain) = dpapi_decrypt(&enc) {
            if let Ok(s) = String::from_utf8(plain) {
                let s = s.trim().to_string();
                if !s.is_empty() {
                    return s;
                }
            }
        }
    }
    std::env::var("OG_LLM_KEY").unwrap_or_default().trim().to_string()
}

/// Encrypt + persist the API key with DPAPI. Empty clears it.
pub fn save_api_key(plain: &str) -> std::io::Result<()> {
    let dir = config_dir();
    fs::create_dir_all(&dir)?;
    let path = api_key_path();
    if plain.is_empty() {
        let _ = fs::remove_file(&path);
        return Ok(());
    }
    match dpapi_encrypt(plain.as_bytes()) {
        Some(enc) => fs::write(path, enc),
        None => Err(std::io::Error::other("DPAPI encrypt failed")),
    }
}

fn dpapi_encrypt(plain: &[u8]) -> Option<Vec<u8>> {
    unsafe {
        let in_blob = CRYPT_INTEGER_BLOB {
            cbData: plain.len() as u32,
            pbData: plain.as_ptr() as *mut u8,
        };
        let mut out_blob = CRYPT_INTEGER_BLOB::default();
        CryptProtectData(
            &in_blob,
            None,
            None,
            None,
            None,
            0,
            &mut out_blob,
        )
        .ok()?;
        let slice = std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize);
        let out = slice.to_vec();
        let _ = LocalFree(Some(HLOCAL(out_blob.pbData as *mut _)));
        Some(out)
    }
}

fn dpapi_decrypt(enc: &[u8]) -> Option<Vec<u8>> {
    unsafe {
        let in_blob = CRYPT_INTEGER_BLOB {
            cbData: enc.len() as u32,
            pbData: enc.as_ptr() as *mut u8,
        };
        let mut out_blob = CRYPT_INTEGER_BLOB::default();
        CryptUnprotectData(
            &in_blob,
            None,
            None,
            None,
            None,
            0,
            &mut out_blob,
        )
        .ok()?;
        let slice = std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize);
        let out = slice.to_vec();
        let _ = LocalFree(Some(HLOCAL(out_blob.pbData as *mut _)));
        Some(out)
    }
}
