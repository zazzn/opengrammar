use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

const LN_ALPHA: f32 = -0.91629076;
const W_CH: f32 = 0.6;
const MARGIN: f32 = 2.0;

#[derive(Debug)]
pub struct NgramModel {
    vocab_size: u32,
    id_of: HashMap<String, u32>,
    uni: Vec<f32>,
    bi: HashMap<u64, f32>,
    floor: f32,
}

impl NgramModel {
    pub fn from_path(path: impl AsRef<Path>) -> io::Result<Self> {
        Self::parse(&fs::read(path)?)
    }

    pub fn parse(buf: &[u8]) -> io::Result<Self> {
        let mut cursor = Cursor::new(buf);
        if cursor.take(4)? != b"OGN1".as_slice() {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "bad OGN1 model magic"));
        }

        let vocab_size = cursor.u32_le()?;
        let bigram_count = cursor.u32_le()?;

        let mut id_of = HashMap::with_capacity(vocab_size as usize);
        for id in 0..vocab_size {
            let len = cursor.u8()? as usize;
            let word = std::str::from_utf8(cursor.take(len)?)
                .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))?
                .to_string();
            id_of.insert(word, id);
        }

        let mut uni = Vec::with_capacity(vocab_size as usize);
        let mut floor = f32::INFINITY;
        for _ in 0..vocab_size {
            let value = cursor.f32_le()?;
            floor = floor.min(value);
            uni.push(value);
        }
        floor -= 5.0;

        let mut bi = HashMap::with_capacity(bigram_count as usize);
        for _ in 0..bigram_count {
            let w1 = cursor.u32_le()?;
            let w2 = cursor.u32_le()?;
            let ln_cond = cursor.f32_le()?;
            bi.insert(Self::bigram_key(vocab_size, w1, w2), ln_cond);
        }

        Ok(Self {
            vocab_size,
            id_of,
            uni,
            bi,
            floor,
        })
    }

    fn bigram_key(vocab_size: u32, w1: u32, w2: u32) -> u64 {
        u64::from(w1) * u64::from(vocab_size) + u64::from(w2)
    }

    fn uni_ln(&self, word: &str) -> f32 {
        self.id_of
            .get(word)
            .and_then(|id| self.uni.get(*id as usize))
            .copied()
            .unwrap_or(self.floor)
    }

    fn cond_ln(&self, w1: &str, w2: &str) -> f32 {
        let Some(a) = self.id_of.get(w1) else {
            return LN_ALPHA + self.uni_ln(w2);
        };
        let Some(b) = self.id_of.get(w2) else {
            return LN_ALPHA + self.uni_ln(w2);
        };
        self.bi
            .get(&Self::bigram_key(self.vocab_size, *a, *b))
            .copied()
            .unwrap_or_else(|| LN_ALPHA + self.uni_ln(w2))
    }

    fn contains(&self, word: &str) -> bool {
        self.id_of.contains_key(word)
    }
}

pub fn rank_candidates(
    model: Option<&NgramModel>,
    text: &str,
    start: usize,
    end: usize,
    original: &str,
    candidates: &[String],
) -> Vec<String> {
    if candidates.len() <= 1 {
        return candidates.to_vec();
    }

    let Some(model) = model else {
        return promote_transposition(original, candidates);
    };

    if !model.contains(&candidates[0].to_ascii_lowercase()) {
        return candidates.to_vec();
    }

    let (left, right) = neighbours(text, start, end);
    let scored = candidates
        .iter()
        .enumerate()
        .map(|(idx, candidate)| {
            let score = score_candidate(model, &left, &right, original, candidate);
            (idx, score)
        })
        .collect::<Vec<_>>();

    let (best_idx, best_score) = scored
        .iter()
        .copied()
        .max_by(|a, b| a.1.total_cmp(&b.1))
        .unwrap_or((0, f32::NEG_INFINITY));
    let incumbent_score = scored.first().map(|(_, score)| *score).unwrap_or(best_score);
    if best_idx == 0
        || best_score - incumbent_score < MARGIN
        || !model.contains(&candidates[best_idx].to_ascii_lowercase())
    {
        return candidates.to_vec();
    }

    let mut ranked = candidates.to_vec();
    let best = ranked.remove(best_idx);
    ranked.insert(0, best);
    ranked
}

pub fn rank_spell_candidates(
    model: Option<&NgramModel>,
    text: &str,
    start: usize,
    end: usize,
    original: &str,
    candidates: &[String],
) -> Vec<String> {
    if candidates.len() <= 1 {
        return candidates.to_vec();
    }

    let Some(model) = model else {
        let mut ranked = candidates.to_vec();
        ranked.sort_by(|a, b| channel(original, b).total_cmp(&channel(original, a)));
        return ranked;
    };

    let (left, right) = neighbours(text, start, end);
    let mut scored = candidates
        .iter()
        .map(|candidate| {
            let score = score_candidate(model, &left, &right, original, candidate);
            (candidate.clone(), score)
        })
        .collect::<Vec<_>>();
    scored.sort_by(|a, b| b.1.total_cmp(&a.1));
    scored.into_iter().map(|(candidate, _)| candidate).collect()
}

fn score_candidate(
    model: &NgramModel,
    left: &str,
    right: &str,
    original: &str,
    candidate: &str,
) -> f32 {
    let word = candidate.to_ascii_lowercase();
    let mut ctx = 0.0;
    let mut parts = 0;
    if !left.is_empty() {
        ctx += model.cond_ln(left, &word);
        parts += 1;
    }
    if !right.is_empty() {
        ctx += model.cond_ln(&word, right);
        parts += 1;
    }
    if parts == 0 {
        ctx = model.uni_ln(&word);
    }
    ctx + W_CH * channel(original, candidate)
}

pub fn promote_transposition(original: &str, candidates: &[String]) -> Vec<String> {
    let mut ranked = candidates.to_vec();
    if ranked.len() <= 1 {
        return ranked;
    }
    let original_chars = sorted_chars(original);
    if sorted_chars(&ranked[0]) == original_chars {
        return ranked;
    }
    if let Some(index) = ranked.iter().position(|candidate| sorted_chars(candidate) == original_chars) {
        let candidate = ranked.remove(index);
        ranked.insert(0, candidate);
    }
    ranked
}

fn neighbours(text: &str, start: usize, end: usize) -> (String, String) {
    let start_byte = char_to_byte(text, start);
    let end_byte = char_to_byte(text, end);
    let before_start = text[..start_byte]
        .char_indices()
        .rev()
        .nth(63)
        .map(|(idx, _)| idx)
        .unwrap_or(0);
    let after_end = text[end_byte..]
        .char_indices()
        .nth(64)
        .map(|(idx, _)| end_byte + idx)
        .unwrap_or(text.len());

    (
        last_word(&text[before_start..start_byte]).unwrap_or_default(),
        first_word(&text[end_byte..after_end]).unwrap_or_default(),
    )
}

fn first_word(text: &str) -> Option<String> {
    let mut current = String::new();
    for ch in text.chars() {
        if is_word_char(ch) {
            current.push(ch.to_ascii_lowercase());
        } else if !current.is_empty() {
            return Some(current);
        }
    }
    (!current.is_empty()).then_some(current)
}

fn last_word(text: &str) -> Option<String> {
    let mut last = None;
    let mut current = String::new();
    for ch in text.chars() {
        if is_word_char(ch) {
            current.push(ch.to_ascii_lowercase());
        } else if !current.is_empty() {
            last = Some(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        last = Some(current);
    }
    last
}

fn is_word_char(ch: char) -> bool {
    ch.is_ascii_alphabetic() || ch == '\'' || ch == '-'
}

fn channel(original: &str, candidate: &str) -> f32 {
    let original = original.to_ascii_lowercase();
    let candidate = candidate.to_ascii_lowercase();
    if original == candidate {
        return -5.0;
    }
    if sorted_chars(&original) == sorted_chars(&candidate) {
        return 1.5;
    }
    let distance = levenshtein(&original, &candidate) as f32;
    let len_diff = original.len().abs_diff(candidate.len()) as f32;
    -(0.6 * distance + 0.4 * len_diff)
}

fn levenshtein(a: &str, b: &str) -> usize {
    let a = a.chars().collect::<Vec<_>>();
    let b = b.chars().collect::<Vec<_>>();
    if a.is_empty() {
        return b.len();
    }
    if b.is_empty() {
        return a.len();
    }

    let mut previous = (0..=b.len()).collect::<Vec<_>>();
    let mut current = vec![0; b.len() + 1];
    for (i, ac) in a.iter().enumerate() {
        current[0] = i + 1;
        for (j, bc) in b.iter().enumerate() {
            let cost = usize::from(ac != bc);
            current[j + 1] = (previous[j + 1] + 1).min(current[j] + 1).min(previous[j] + cost);
        }
        std::mem::swap(&mut previous, &mut current);
    }
    previous[b.len()]
}

fn sorted_chars(word: &str) -> String {
    let mut chars = word.to_ascii_lowercase().chars().collect::<Vec<_>>();
    chars.sort_unstable();
    chars.into_iter().collect()
}

fn char_to_byte(text: &str, char_index: usize) -> usize {
    text.char_indices()
        .nth(char_index)
        .map(|(idx, _)| idx)
        .unwrap_or(text.len())
}

struct Cursor<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl<'a> Cursor<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, offset: 0 }
    }

    fn take(&mut self, len: usize) -> io::Result<&'a [u8]> {
        let end = self
            .offset
            .checked_add(len)
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "model offset overflow"))?;
        let slice = self
            .bytes
            .get(self.offset..end)
            .ok_or_else(|| io::Error::new(io::ErrorKind::UnexpectedEof, "truncated OGN1 model"))?;
        self.offset = end;
        Ok(slice)
    }

    fn u8(&mut self) -> io::Result<u8> {
        Ok(self.take(1)?[0])
    }

    fn u32_le(&mut self) -> io::Result<u32> {
        let bytes = self.take(4)?;
        Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    fn f32_le(&mut self) -> io::Result<f32> {
        let bytes = self.take(4)?;
        Ok(f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }
}
