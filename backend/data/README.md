# Type-scoped complaint data sources

Place Excel/CSV/JSON historic case files here.

- `internal/` → used when complaint Type = Internal
- `supplier/` → used when complaint Type = Supplier

Supported files: `.json` (array of cases), `.csv` (headers: id,symptom,description,rootCause,whyWhy,correctiveAction,preventiveAction).

Also tag Knowledge Base documents with `source_type` = Internal | Supplier | General.
