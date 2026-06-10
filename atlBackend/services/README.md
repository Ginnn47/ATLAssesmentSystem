# Backend Service Ownership

Backend services own domain data and calculations. Frontend pages may format values
for display, but must not reimplement Fuzzy-AHP or ATL student scoring.

| Service | Responsibility | Main consumers |
| --- | --- | --- |
| `FuzzyATLEquation.py` | Synthetic Extent Fuzzy-AHP, pairwise packages, canonical rubric scale/score conversion, weighted ATL scoring | Expert Management, Report, Dashboard, Student Management, Detailed/Batch saved score and realtime preview |
| `catalog.py` | Database-backed class, student, subject, and topic catalog | Detailed, Batch, Report, Student Management |
| `contextual_atl.py` | Context/rubric orchestration, assessment synchronization, weight snapshot persistence, context report | Criteria Management, Expert Management, Input ATL, Report |
| `analytics.py` | Class and student analytics response builders | Student Management |
| `dashboard.py` | Dashboard-specific database queries and response builder | Dashboard |
| `reports.py` | Report rows, detail narratives, and category summaries | Report and Excel preview |
| `labels.py` | Canonical ATL hierarchy/aliases, category metadata, rubric display metadata, and score levels | All pages through the labels API |
| `excel_export.py` | XLSX filename validation and workbook generation | Report and Detailed export |

## Removed Redundant Services

- `fuzzy_ahp.py`: merged into `FuzzyATLEquation.py`.
- `scoring.py`: merged into `FuzzyATLEquation.py`.
- Client/localStorage analytics builders: removed from backend services because the
  database-backed API is the official source.

## Boundary Rules

- `contextual_atl.py` persists and orchestrates calculations but does not implement
  equations.
- `analytics.py`, `dashboard.py`, and `reports.py` may aggregate official scores,
  but must call `FuzzyATLEquation.py` for scoring.
- Canonical rubric scores live only in `FuzzyATLEquation.py`; canonical ATL names
  and aliases live only in `labels.py`.
- `POST /api/assessments/preview/` calculates Detailed/Batch working drafts with
  the official equation service and never persists assessment rows.
- Chart geometry, formatting, pagination, and hover state remain frontend concerns.
