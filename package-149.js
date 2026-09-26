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
  const panel = document.createElement('div');
  panel.id = 'package149Panel';
  panel.className = 'balcarOffer insuranceOffer';
  panel.innerHTML = `<h3>חבילה מלאה לרכב אחד — 149 ₪</h3>
    <p>דוח עבר ביטוחי, פענוח דוח המכון והתייעצות אישית אחת עם הבוחן עמוס רוקח בוואטסאפ למשך 48 שעות. ניתן להשתמש בשירותי החבילה עד 90 יום ממועד הרכישה.</p>
    <button class="primary" type="button" onclick="startPayment('full149')">רכישת החבילה — 149 ₪</button>`;
  insurance.insertAdjacentElement('afterend', panel);

  const activePackage = () => {
    const saved = storedBuyTestPayment();
    return saved?.plan === PACKAGE && saved.plate === plate() && !!saved.accessToken ? saved : null;
  };
  function syncPackageUI() {
    const saved = activePackage();
    const manager = document.body.classList.contains('manager-mode');
    panel.hidden = !!saved;
    const packageButton = panel.querySelector('button');
    if (packageButton) packageButton.textContent = manager ? 'פתיחת חבילת 149 ₪ ללא חיוב' : 'רכישת החבילה — 149 ₪';
    if (originalInsuranceButton) originalInsuranceButton.textContent = saved
      ? 'הפקת דוח העבר הביטוחי הכלול בחבילה'
      : manager ? 'תצוגת דוח עבר ביטוחי — ללא חיוב' : 'הפקת עבר ביטוחי — 39 ₪';
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
      if (insuranceStatus) insuranceStatus.textContent = 'מצב מנהל — לא הוזמן דוח מספק חיצוני ולא בוצע חיוב.';
      showBuyTestAccessNotice('מצב מנהל — חבילת 149 ₪ פתוחה לתצוגה ללא חיוב. הפקת דוח עבר ביטוחי מספק חיצוני אינה מבוצעת בתצוגה זו.');
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

  async function loadPackageInsurance(saved, seller = {}) {
    const status = document.getElementById('balcarOrderStatus');
    if (status) status.textContent = 'מפיק את דוח העבר הביטוחי הכלול בחבילה...';
    try {
      let data = await callBuyTestBalcarService({
        action: 'createPaid', plate: saved.plate, orderId: saved.orderId,
        clientSecret: saved.clientSecret, ...seller
      });
      for (let attempt = 0; attempt < 24 && data?.status !== 'ready'; attempt++) {
        if (['failed', 'cancelled'].includes(String(data?.status))) throw new Error('report_failed');
        await new Promise(resolve => setTimeout(resolve, 5000));
        data = await callBuyTestBalcarService({
          action: 'statusPaid', plate: saved.plate, orderId: saved.orderId,
          clientSecret: saved.clientSecret
        });
      }
      if (data?.status === 'ready') {
        window.buytestBalcarReport = data;
        renderPaidBalcarReport(data);
        document.getElementById('balcarReportSection')?.scrollIntoView({behavior: 'smooth', block: 'start'});
      } else if (status) {
        status.textContent = 'הדוח עדיין בהכנה. אפשר ללחוץ שוב על הפקת הדוח כדי לבדוק את מצבו.';
      }
    } catch (error) {
      if (status) status.textContent = 'לא הצלחנו להשלים כרגע את הדוח. החבילה כבר שולמה; אין לשלם שוב. נסה להפיק את הדוח מחדש.';
    }
  }
  const oldInsurancePayment = startBalcarPayment;
  startBalcarPayment = async function (...args) {
    if (document.body.classList.contains('manager-mode') && activeBuyTestPlan() === PACKAGE) {
      const status = document.getElementById('balcarOrderStatus');
      if (status) status.textContent = 'מצב מנהל — לא בוצעה הזמנה מספק הדוח ולא נגבה תשלום.';
      showBuyTestAccessNotice('דוח עבר ביטוחי אמיתי מחייב רכב והזמנה מהספק. תצוגת חבילת 149 ₪ פתוחה ללא חיוב.');
      return;
    }
    const saved = activePackage();
    if (!saved) return oldInsurancePayment(...args);
    const message = document.getElementById('balcarEligibilityMsg');
    const button = originalInsuranceButton;
    if (button) button.disabled = true;
    try {
      const eligibility = await callBuyTestBalcarService({action: 'eligibility', plate: saved.plate, serviceId: BUYTEST_BALCAR_SERVICE_ID});
      let seller = {};
      if (eligibility?.requiresSellerDetails) {
        const fields = document.getElementById('insuranceSellerFields');
        const ownershipDate = document.getElementById('insuranceOwnershipDate')?.value || '';
        const ownerIsraeliId = (document.getElementById('insuranceOwnerId')?.value || '').replace(/\D/g, '');
        if (fields?.style.display !== 'block' || !/^\d{4}-\d{2}-\d{2}$/.test(ownershipDate) || !/^\d{9}$/.test(ownerIsraeliId)) {
          if (fields) fields.style.display = 'block';
          if (message) message.textContent = 'כדי להפיק את הדוח מלאו את תאריך תחילת הבעלות ואת מספר תעודת הזהות, ואז לחצו שוב.';
          return;
        }
        seller = {ownershipDate, ownerIsraeliId};
      }
      await loadPackageInsurance(saved, seller);
    } catch (error) {
      if (message) message.textContent = 'לא ניתן לבדוק כרגע את זמינות הדוח. לא בוצע חיוב נוסף.';
    } finally {
      if (button) button.disabled = false;
    }
  };
  const originalPaidReport = loadPaidBalcarReport;
  loadPaidBalcarReport = async function (...args) {
    const saved = activePackage();
    if (!saved) return originalPaidReport(...args);
    let details = {};
    try { details = JSON.parse(localStorage.getItem(BUYTEST_INSURANCE_DETAILS_KEY) || '{}'); } catch (_) {}
    if (String(details.plate || '') !== String(saved.plate)) details = {};
    await loadPackageInsurance(saved, details);
    return !!window.buytestBalcarReport;
  };
  const originalResume = resumePaidVehicleFlow;
  resumePaidVehicleFlow = async function (...args) {
    const result = await originalResume(...args);
    if (result && activePackage() && !window.buytestBalcarReport) await loadPaidBalcarReport();
    return result;
  };
  const oldPreview = previewPlanAsManager;
  previewPlanAsManager = function (plan = 'all') {
    const result = oldPreview(plan);
    if (plan === PACKAGE && document.body.classList.contains('manager-mode')) {
      showInsuranceStart();
      const insuranceStatus = document.getElementById('balcarOrderStatus');
      if (insuranceStatus) insuranceStatus.textContent = 'מצב מנהל — לא הוזמן דוח מספק חיצוני ולא בוצע חיוב.';
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
