/* Single-vehicle package. Loaded after the existing BuyTest application. */
(() => {
  const PACKAGE = 'full149';
  buytestPlans[PACKAGE] = {
    name: 'חבילה מלאה לרכב אחד',
    price: 149,
    scope: 'דוח עבר ביטוחי, פענוח דוח המכון והתייעצות אישית אחת עם הבוחן עמוס רוקח'
  };
  if (!buytestPlanClasses.includes('plan-full149')) buytestPlanClasses.push('plan-full149');

  const css = document.createElement('style');
  css.textContent = `
    body.plan-full149 .balcarFeature,body.plan-full149 .reportFeature{display:block!important}
    body.plan-full149.report-complete .postReportConsultation{display:block}
    body.package149-consultation .clarificationBox.show .consultationLocked{display:none!important}
    body.package149-consultation .clarificationBox.show .consultationUnlocked{display:block!important}
    #insuranceStartSection .insuranceOffer{padding:15px 16px;border-width:2px}
    #insuranceStartSection .insuranceOffer h3{font-size:21px;margin-bottom:9px}
    #insuranceStartSection #balcarPlanButton{min-height:45px;font-size:16px}
    #package149Panel{margin-top:14px;border-color:#90d6bf;background:#f3fbf8}
  `;
  document.head.appendChild(css);

  const section = document.getElementById('insuranceStartSection');
  if (!section) return;
  const legacy = section.querySelector('.insuranceOffer');
  if (legacy?.querySelector('button[onclick*="requestBuyTestPackage"]')) legacy.remove();
  const insurance = section.querySelector('.insuranceOffer');
  if (!insurance) return;
  const originalInsuranceButton = document.getElementById('balcarPlanButton');
  originalInsuranceButton?.classList.remove('full');
  // Retired offer: retain fulfillment for existing paid orders, but never
  // insert a purchase panel for new customers.

  const activePackage = () => {
    const saved = storedBuyTestPayment();
    return saved?.plan === PACKAGE && saved.plate === plate() && !!saved.accessToken ? saved : null;
  };
  function syncPackageUI() {
    const saved = activePackage();
    const manager = document.body.classList.contains('manager-mode');
    if (originalInsuranceButton) originalInsuranceButton.textContent = saved
      ? 'העלאת קובץ דוח העבר הביטוחי הכלול בחבילה'
      : manager ? 'תצוגת העלאת קובץ — ללא חיוב' : 'העלאת קובץ דוח עבר ביטוחי';
    let consult = false;
    if (saved?.accessToken) {
      try {
        const part = saved.accessToken.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
        const token = JSON.parse(atob(part));
        consult = Array.isArray(token.scopes) && token.scopes.includes('consultation');
      } catch (_) {}
    }
    document.body.classList.toggle('package149-consultation', consult);
  }
  const oldShowInsuranceStart = showInsuranceStart;
  showInsuranceStart = function (...args) {
    const result = oldShowInsuranceStart(...args);
    syncPackageUI();
    return result;
  };
  const oldRestoreAccess = restoreBuyTestAccess;
  restoreBuyTestAccess = async function (options = {}) {
    const result = await oldRestoreAccess(options);
    if (result && activePackage()) {
      showInsuranceStart();
      if (options.scroll) {
        document.getElementById(customerEntryRoute === 'report' ? 'afterInspectionSection' : 'insuranceStartSection')
          ?.scrollIntoView({behavior: 'smooth', block: 'start'});
      }
    }
    syncPackageUI();
    return result;
  };
  const oldPayment = startPayment;
  startPayment = async function (selected = 'report') {
    if (document.body.classList.contains('manager-mode') && selected === PACKAGE) {
      applyPlanAccess(PACKAGE, {scroll: false, progress: {preInspectionCompleted: true, reportCompleted: false}});
      showInsuranceStart();
      const insuranceStatus = document.getElementById('balcarOrderStatus');
      if (insuranceStatus) insuranceStatus.textContent = 'מצב מנהל — ניתן להעלות קובץ דוח לפענוח ללא חיוב.';
      showBuyTestAccessNotice('מצב מנהל — חבילת 149 ₪ פתוחה לתצוגה ללא חיוב. אפשר להעלות קובץ דוח ולפענח אותו במכשיר.');
      section.scrollIntoView({behavior: 'smooth', block: 'start'});
      return;
    }
    if (document.body.classList.contains('manager-mode') && selected === 'consultation' && activeBuyTestPlan() === PACKAGE) {
      setBuyTestStageProgress({preInspectionCompleted: true, reportCompleted: true});
      document.body.classList.add('package149-consultation');
      showClarificationOptions();
      document.getElementById('clarificationBox')?.scrollIntoView({behavior: 'smooth', block: 'start'});
      return;
    }
    const saved = activePackage();
    if (saved && selected === 'report') {
      document.getElementById('afterInspectionSection')?.scrollIntoView({behavior: 'smooth', block: 'start'});
      return;
    }
    if (saved && selected === 'consultation') {
      if (!buyTestStageProgress.reportCompleted) {
        showBuyTestAccessNotice('ההתייעצות נפתחת לאחר השלמת פענוח דוח המכון.', true);
        return;
      }
      try {
        const result = await callBuyTestPaymentService({
          action: 'claimPackageConsultation', plate: saved.plate,
          orderId: saved.orderId, clientSecret: saved.clientSecret
        });
        saveBuyTestPayment({...saved, accessToken: result.accessToken, progress: normalizedStageProgress(result.progress)});
        syncPackageUI();
        showClarificationOptions();
        document.getElementById('clarificationBox')?.scrollIntoView({behavior: 'smooth', block: 'start'});
      } catch (error) {
        showBuyTestAccessNotice('לא ניתן לפתוח כעת את ההתייעצות שבחבילה. לא בוצע חיוב נוסף.', true);
      }
      return;
    }
    return oldPayment(selected);
  };
  const oldRoadmap = updateBuyTestRoadmap;
  updateBuyTestRoadmap = function (...args) {
    const result = oldRoadmap(...args);
    if (activeBuyTestPlan() === PACKAGE && !buyTestStageProgress.reportCompleted) {
      setRoadmapCard('report', 'current', 'הפענוח כלול בחבילה', 'מעבר להעלאת הדוח', false);
    }
    return result;
  };

  const oldPreview = previewPlanAsManager;
  previewPlanAsManager = function (plan = 'all') {
    const result = oldPreview(plan);
    if (plan === PACKAGE && document.body.classList.contains('manager-mode')) {
      showInsuranceStart();
      const insuranceStatus = document.getElementById('balcarOrderStatus');
      if (insuranceStatus) insuranceStatus.textContent = 'מצב מנהל — ניתן להעלות קובץ דוח לפענוח ללא חיוב.';
    }
    return result;
  };
  const managerButtons = document.querySelector('#managerHub .managerHubGrid');
  if (managerButtons && !managerButtons.querySelector('[data-manager-plan="report_consultation"]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.managerPlan = 'report_consultation';
    button.textContent = 'חבילת 129 ₪';
    button.addEventListener('click', () => {
      openAfterPage();
      startPayment('report_consultation');
    });
    managerButtons.appendChild(button);
  }
  syncPackageUI();
})();
