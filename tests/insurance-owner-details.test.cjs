const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),server=fs.readFileSync(require.resolve('../supabase/functions/balcar/index.ts'),'utf8');
const context={Date};vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('function buytestInsuranceDetailsError('),html.indexOf('async function retryPaidBalcarWithDetails(')),context);
vm.runInContext(stripTypeScriptTypes(server.slice(server.indexOf('function validInsuranceDetails('),server.indexOf('Deno.serve('))),context);
test('ownership details validate checksum and date consistently on client and server',()=>{
 for(const [date,id,valid] of [['2026-02-19','123456782',true],['2026-02-19','123456789',false],['2026-02-19','000000000',false],['2026-02-30','123456782',false],['2099-01-01','123456782',false],['','123456782',false],['2026-02-19','',false]]){
  assert.equal(!context.buytestInsuranceDetailsError(date,id),valid);assert.equal(context.validInsuranceDetails(date,id),valid);
 }
});
test('ownership data blocks a new supplier order after preserving already-created reports',()=>{
 const branch=server.slice(server.indexOf('if (action === "createPaid"'),server.indexOf('// Legacy access-code'));
 assert.ok(branch.indexOf('if (savedReportId)')<branch.indexOf('if (!validInsuranceDetails'));
 assert.ok(branch.indexOf('if (!validInsuranceDetails')<branch.indexOf('const eligibility'));
 assert.ok(branch.indexOf('if (!validInsuranceDetails')<branch.indexOf('method: "POST"'));
 assert.match(html,/id="paymentInsuranceRequirement"/);assert.match(html,/id="insuranceSellerFields" style="display:block/);
});
