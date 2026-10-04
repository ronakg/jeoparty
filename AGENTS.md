# Project Instructions & Release Standards

## Release Notes Guidelines
- Release notes for each release must be a concise bulleted list of major
  features.
- If there are no major features worth highlighting in the release, use
  strictly:
  `Bug fixes and performance improvements.`
- Tag releases using annotated git tags (`git tag -a vX.Y.Z -m "..."`) so that
  GitHub Releases and CI pipelines automatically inherit the notes.
