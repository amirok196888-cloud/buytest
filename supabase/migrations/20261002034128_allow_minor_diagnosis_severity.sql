ALTER TABLE public.buytest_formula_overrides DROP CONSTRAINT buytest_formula_overrides_report_severity_check;
ALTER TABLE public.buytest_formula_overrides ADD CONSTRAINT buytest_formula_overrides_report_severity_check CHECK (report_severity IN ('safety','high','medium','low','minor','none'));
