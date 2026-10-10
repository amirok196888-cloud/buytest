# BuyTest maintenance

- Change only what Amos requested. Preserve the existing design and buttons unless the particular change is explicitly authorized.
- Preserve previous fixes and manager-written diagnoses, meanings and severity. Delete only the selected record by stable identity.
- Diagnose findings using the source component, not a preceding OCR heading. Keep report severity attached to its actual system and clause.
- For changes to inspection reading, diagnoses, saved overrides or report output, run the exact command in `.github/workflows/diagnosis-regression.yml` before publishing. A failing relevant check blocks publication; do not remove assertions to hide a regression.
- Add a regression for a recurring defect using anonymized source evidence. Verify the complete affected path from OCR through server parsing, saved manager edits, summary and PDF output. Test known prior failures as well as the newly reported case.
- Compare the active server and the current main branch before publishing; preserve concurrent edits. Verify the completed Pages deployment and active server source before saying a repair is published.
- The workflow checks changes automatically. The GitHub Pages branch deployment is separate, so a green local check is also required before updating main or deploying the server.
- Never commit uploaded reports, source screenshots, customer names, vehicle identifiers or credentials as test fixtures.
