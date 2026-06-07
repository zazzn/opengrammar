//! Minimal word-level diff for the rewrite preview — the desktop analogue of the
//! extension's token diff (`src/content/diff.ts`). Shows the user WHAT a rewrite
//! changed (inserted / deleted words) instead of forcing them to re-read the whole
//! sentence.

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Op {
    Eq,
    Ins,
    Del,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Seg {
    pub op: Op,
    pub text: String,
}

/// Word-level LCS diff in reading order: equal words, insertions (only in `b`),
/// deletions (only in `a`). A replacement surfaces as `Del(old)` then `Ins(new)`.
/// Whitespace is collapsed (the preview re-inserts a single space between words).
pub fn word_diff(a: &str, b: &str) -> Vec<Seg> {
    let aw: Vec<&str> = a.split_whitespace().collect();
    let bw: Vec<&str> = b.split_whitespace().collect();
    let n = aw.len();
    let m = bw.len();

    // LCS length table (suffix DP).
    let mut dp = vec![vec![0u32; m + 1]; n + 1];
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            dp[i][j] = if aw[i] == bw[j] {
                dp[i + 1][j + 1] + 1
            } else {
                dp[i + 1][j].max(dp[i][j + 1])
            };
        }
    }

    let mut segs = Vec::new();
    let (mut i, mut j) = (0usize, 0usize);
    while i < n && j < m {
        if aw[i] == bw[j] {
            segs.push(Seg { op: Op::Eq, text: aw[i].to_string() });
            i += 1;
            j += 1;
        } else if dp[i + 1][j] >= dp[i][j + 1] {
            segs.push(Seg { op: Op::Del, text: aw[i].to_string() });
            i += 1;
        } else {
            segs.push(Seg { op: Op::Ins, text: bw[j].to_string() });
            j += 1;
        }
    }
    while i < n {
        segs.push(Seg { op: Op::Del, text: aw[i].to_string() });
        i += 1;
    }
    while j < m {
        segs.push(Seg { op: Op::Ins, text: bw[j].to_string() });
        j += 1;
    }
    segs
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ops(segs: &[Seg]) -> Vec<(Op, &str)> {
        segs.iter().map(|s| (s.op, s.text.as_str())).collect()
    }

    #[test]
    fn replacement() {
        let segs = word_diff("the quick brown fox", "the quick red fox");
        assert_eq!(
            ops(&segs),
            vec![
                (Op::Eq, "the"),
                (Op::Eq, "quick"),
                (Op::Del, "brown"),
                (Op::Ins, "red"),
                (Op::Eq, "fox"),
            ]
        );
    }

    #[test]
    fn pure_insert() {
        assert_eq!(
            ops(&word_diff("a b", "a x b")),
            vec![(Op::Eq, "a"), (Op::Ins, "x"), (Op::Eq, "b")]
        );
    }

    #[test]
    fn pure_delete() {
        assert_eq!(
            ops(&word_diff("a x b", "a b")),
            vec![(Op::Eq, "a"), (Op::Del, "x"), (Op::Eq, "b")]
        );
    }

    #[test]
    fn no_change() {
        assert!(word_diff("same text here", "same text here").iter().all(|s| s.op == Op::Eq));
    }

    #[test]
    fn full_rewrite() {
        let segs = word_diff("alpha beta", "gamma delta");
        assert!(segs.iter().any(|s| s.op == Op::Del));
        assert!(segs.iter().any(|s| s.op == Op::Ins));
    }
}
