import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════
// CWIN ENTERPRISE CARE PLATFORM v3.1
// Editorial Design — Training, Case Mgmt, Wellness, Portals, Compliance
// "Care When It's Needed"
// ═══════════════════════════════════════════════════════════════════════

const CO={name:"CWIN At Home",legal:"CWIN At Home LLC",tag:"Care When It's Needed",addr:"15941 S. Harlem Ave. #305, Tinley Park IL 60477",phone:"708.476.0021",email:"CWINathome@gmail.com"};

// ═══════════════════════════════════════════════════════════════════════
// SUPABASE CONNECTION — Photo storage + data persistence
// ═══════════════════════════════════════════════════════════════════════
const SB_URL="https://okvyhbypncctevvtwqkf.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rdnloYnlwbmNjdGV2dnR3cWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NzA2NDEsImV4cCI6MjA4NjE0NjY0MX0.fD1sI9QkCeq_d8blnxH2vIi6i7C1mCVKaGTG_dHxNXY";
const sbHeaders={"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY};

// Upload photo to Supabase Storage (avatars bucket)
async function sbUploadPhoto(file,entityType,entityId){
  try{
    const ext=file.name?.split(".").pop()||"jpg";
    const path=entityType+"/"+entityId+"."+ext;
    const resp=await fetch(SB_URL+"/storage/v1/object/avatars/"+path,{
      method:"POST",
      headers:{...sbHeaders,"Content-Type":file.type||"image/jpeg","x-upsert":"true"},
      body:file
    });
    if(!resp.ok){const err=await resp.text();console.error("Upload error:",err);return null;}
    return SB_URL+"/storage/v1/object/public/avatars/"+path+"?t="+Date.now();
  }catch(e){console.error("Upload failed:",e);return null;}
}

// Upload base64 image to Supabase Storage
async function sbUploadBase64(base64,entityType,entityId){
  try{
    const parts=base64.split(",");
    const mime=parts[0].match(/:(.*?);/)?.[1]||"image/jpeg";
    const ext=mime.split("/")[1]||"jpg";
    const binary=atob(parts[1]);
    const arr=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)arr[i]=binary.charCodeAt(i);
    const blob=new Blob([arr],{type:mime});
    const path=entityType+"/"+entityId+"."+ext;
    const resp=await fetch(SB_URL+"/storage/v1/object/avatars/"+path,{
      method:"POST",
      headers:{...sbHeaders,"Content-Type":mime,"x-upsert":"true"},
      body:blob
    });
    if(!resp.ok){const err=await resp.text();console.error("Upload error:",err);return null;}
    return SB_URL+"/storage/v1/object/public/avatars/"+path+"?t="+Date.now();
  }catch(e){console.error("Upload failed:",e);return null;}
}

// Upload receipt image to Supabase Storage (receipts bucket - private)
async function sbUploadReceipt(base64,expenseId){
  try{
    const parts=base64.split(",");
    const mime=parts[0].match(/:(.*?);/)?.[1]||"image/jpeg";
    const ext=mime.split("/")[1]||"jpg";
    const binary=atob(parts[1]);
    const arr=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)arr[i]=binary.charCodeAt(i);
    const blob=new Blob([arr],{type:mime});
    const path="expenses/"+expenseId+"."+ext;
    // Try receipts bucket first, fall back to avatars
    let resp=await fetch(SB_URL+"/storage/v1/object/receipts/"+path,{
      method:"POST",
      headers:{...sbHeaders,"Content-Type":mime,"x-upsert":"true"},
      body:blob
    });
    if(!resp.ok){
      // Fall back to avatars bucket which is public
      resp=await fetch(SB_URL+"/storage/v1/object/avatars/receipt/"+expenseId+"."+ext,{
        method:"POST",
        headers:{...sbHeaders,"Content-Type":mime,"x-upsert":"true"},
        body:blob
      });
      if(!resp.ok){const err=await resp.text();console.error("Receipt upload error:",err);return null;}
      return SB_URL+"/storage/v1/object/public/avatars/receipt/"+expenseId+"."+ext+"?t="+Date.now();
    }
    return SB_URL+"/storage/v1/object/public/receipts/"+path+"?t="+Date.now();
  }catch(e){console.error("Receipt upload failed:",e);return null;}
}

// ═══════════════════════════════════════════════════════════════════════
// STATUS DEFINITIONS — Every status used across the platform
// ═══════════════════════════════════════════════════════════════════════
const STATUS_DEFS={
  // ── Client Statuses ──
  client:{
    active:{label:"Active",desc:"Currently receiving care services",color:"ok"},
    on_hold:{label:"On Hold",desc:"Services temporarily paused (hospitalization, vacation, family request)",color:"wn"},
    pending_assessment:{label:"Pending Assessment",desc:"Initial inquiry received, assessment not yet completed",color:"bl"},
    pending_start:{label:"Pending Start",desc:"Assessment done, agreement signed, awaiting first visit",color:"bl"},
    discharged:{label:"Discharged",desc:"Services ended (goals met, moved, deceased, transferred to facility)",color:"er"},
    inactive:{label:"Inactive",desc:"No active services for 30+ days, not formally discharged",color:"er"},
  },
  // ── Caregiver Statuses ──
  caregiver:{
    active:{label:"Active",desc:"Cleared to work, accepting assignments",color:"ok"},
    onboarding:{label:"Onboarding",desc:"Hired, completing orientation, background check, and training requirements",color:"bl"},
    on_leave:{label:"On Leave",desc:"Approved leave of absence (medical, personal, vacation)",color:"wn"},
    suspended:{label:"Suspended",desc:"Temporarily removed from assignments pending investigation",color:"er"},
    probation:{label:"Probation",desc:"90-day probationary period, performance under review",color:"wn"},
    terminated:{label:"Terminated",desc:"Employment ended (voluntary or involuntary)",color:"er"},
    inactive:{label:"Inactive",desc:"No shifts for 30+ days, not formally terminated",color:"er"},
  },
  // ── Schedule/Shift Statuses ──
  schedule:{
    draft:{label:"Draft",desc:"Created but not visible to caregivers. Can be edited freely.",color:"wn"},
    published:{label:"Published",desc:"Visible to assigned caregiver. Changes will trigger notification.",color:"ok"},
    confirmed:{label:"Confirmed",desc:"Caregiver has acknowledged and confirmed the shift.",color:"ok"},
    in_progress:{label:"In Progress",desc:"Caregiver has clocked in. Shift is active.",color:"bl"},
    completed:{label:"Completed",desc:"Caregiver clocked out. Pending reconciliation.",color:"ok"},
    missed:{label:"Missed",desc:"No clock-in recorded. Requires follow-up.",color:"er"},
    cancelled:{label:"Cancelled",desc:"Shift cancelled before start (by office, client, or caregiver).",color:"er"},
  },
  // ── Incident Statuses ──
  incident:{
    open:{label:"Open",desc:"Reported, awaiting review and action plan",color:"er"},
    under_review:{label:"Under Review",desc:"Being investigated, gathering information",color:"wn"},
    action_taken:{label:"Action Taken",desc:"Response implemented, monitoring outcomes",color:"bl"},
    resolved:{label:"Resolved",desc:"Issue addressed, follow-up complete, case closed",color:"ok"},
    escalated:{label:"Escalated",desc:"Referred to higher authority (MD, state agency, legal)",color:"er"},
  },
  // ── Expense Statuses ──
  expense:{
    pending:{label:"Pending",desc:"Submitted by caregiver, awaiting manager/owner review",color:"wn"},
    approved:{label:"Approved",desc:"Verified and approved for reimbursement",color:"ok"},
    rejected:{label:"Rejected",desc:"Denied (missing receipt, not billable, policy violation)",color:"er"},
    reimbursed:{label:"Reimbursed",desc:"Payment issued to caregiver",color:"ok"},
    billed:{label:"Billed to Client",desc:"Added to client invoice as reimbursable expense",color:"bl"},
  },
  // ── Recruiting Statuses ──
  cg_applicant:{
    new:{label:"New",desc:"Application received, not yet reviewed",color:"pu"},
    screening:{label:"Screening",desc:"Initial phone screen, credential verification in progress",color:"bl"},
    interview:{label:"Interview",desc:"Scheduled or completed in-person/video interview",color:"bl"},
    reference_check:{label:"Reference Check",desc:"Contacting references and previous employers",color:"wn"},
    bg_check:{label:"Background Check",desc:"Background check submitted, awaiting results",color:"wn"},
    offer:{label:"Offer Extended",desc:"Conditional or formal offer sent to candidate",color:"ok"},
    hired:{label:"Hired",desc:"Offer accepted, entering onboarding",color:"ok"},
    rejected:{label:"Rejected",desc:"Did not meet requirements or declined offer",color:"er"},
    withdrawn:{label:"Withdrawn",desc:"Candidate withdrew from consideration",color:"er"},
  },
  client_lead:{
    new:{label:"New Lead",desc:"Initial inquiry or referral received",color:"pu"},
    inquiry:{label:"Inquiry",desc:"Contacted, gathering information about care needs",color:"bl"},
    assessment:{label:"Assessment",desc:"In-home assessment scheduled or completed",color:"bl"},
    proposal:{label:"Proposal Sent",desc:"Service agreement and pricing sent to family",color:"wn"},
    active:{label:"Active Client",desc:"Agreement signed, services started",color:"ok"},
    lost:{label:"Lost",desc:"Did not convert (chose competitor, no longer needed, cost)",color:"er"},
  },
  // ── Compliance Statuses ──
  compliance:{
    current:{label:"Current",desc:"Up to date, no action needed",color:"ok"},
    expiring_soon:{label:"Expiring Soon",desc:"Due within 30 days, renewal needed",color:"wn"},
    overdue:{label:"Overdue",desc:"Past due date, immediate action required",color:"er"},
    not_applicable:{label:"N/A",desc:"Does not apply to this entity",color:"bl"},
  },
  // ── Care Goal Statuses ──
  care_goal:{
    on_track:{label:"On Track",desc:"Progress within expected range toward target",color:"ok"},
    achieved:{label:"Achieved",desc:"Goal met, maintain or set new target",color:"ok"},
    at_risk:{label:"At Risk",desc:"Progress stalled or regressing, care plan adjustment needed",color:"er"},
    modified:{label:"Modified",desc:"Goal adjusted based on changing client condition",color:"wn"},
    discontinued:{label:"Discontinued",desc:"Goal no longer relevant (condition change, client preference)",color:"er"},
  },
  // ── Service Request Statuses ──
  service_request:{
    pending:{label:"Pending",desc:"Submitted, awaiting office review",color:"wn"},
    acknowledged:{label:"Acknowledged",desc:"Received and noted, working on response",color:"bl"},
    approved:{label:"Approved",desc:"Request approved and scheduled/implemented",color:"ok"},
    completed:{label:"Completed",desc:"Request fulfilled",color:"ok"},
    denied:{label:"Denied",desc:"Cannot accommodate (with explanation)",color:"er"},
    resolved:{label:"Resolved",desc:"Issue addressed to client's satisfaction",color:"ok"},
  },
};

// ═══════════════════════════════════════════════════════════════════════
// ADL OPTIONS — Per-category, clinically comprehensive (Katz/Barthel aligned)
// ═══════════════════════════════════════════════════════════════════════
const ADL_OPTIONS={
  bathing:[
    "Independent — bathes self completely without assistance",
    "Independent with setup — needs help gathering supplies or adjusting water temperature only",
    "Supervision — caregiver present for safety, verbal cues only",
    "Standby assist — caregiver within arm's reach, hands-off unless needed",
    "Minimal assist (25%) — can do most of task, needs help with one body part (e.g. back, feet)",
    "Moderate assist (50%) — needs hands-on help with washing upper or lower body",
    "Maximum assist (75%) — does some part of task, caregiver does majority",
    "Total dependence — caregiver performs entire bathing task",
    "Sponge bath only — unable to use tub/shower, bed bath required",
    "Refuses bathing — client declines, requires motivational approach",
  ],
  dressing:[
    "Independent — selects clothes and dresses without assistance",
    "Independent with setup — needs clothes laid out or adaptive closet",
    "Supervision — verbal cues for sequencing or weather-appropriate choices",
    "Standby assist — can dress self but needs someone nearby for balance",
    "Minimal assist (25%) — needs help with buttons, zippers, or back closures",
    "Moderate assist (50%) — can do upper or lower body but not both",
    "Maximum assist (75%) — participates but caregiver does majority",
    "Total dependence — caregiver performs all dressing tasks",
    "Minimal assist due to tremor — fine motor difficulty with fasteners",
    "Adaptive equipment — uses button hook, elastic laces, velcro closures",
  ],
  eating:[
    "Independent — feeds self without assistance",
    "Independent with setup — needs meal cut, containers opened, tray positioned",
    "Independent with adaptive equipment — uses built-up utensils, plate guard, etc.",
    "Supervision — monitoring for choking, pacing, or intake adequacy",
    "Minimal assist (25%) — occasional steadying of hand or utensil guidance",
    "Moderate assist (50%) — feeds self with frequent help, may tire mid-meal",
    "Maximum assist (75%) — needs hand-over-hand or mostly fed by caregiver",
    "Total dependence — must be fed entirely by caregiver",
    "Modified texture diet — requires pureed, minced, or soft foods",
    "Tube feeding — receives nutrition via PEG/NG tube",
    "NPO — nothing by mouth (medical restriction)",
  ],
  toileting:[
    "Independent — uses toilet without assistance, manages clothing",
    "Independent with equipment — uses raised seat, grab bars, or commode",
    "Supervision — reminders to go, verbal cues for hygiene",
    "Standby assist — needs someone nearby for transfers or balance",
    "Minimal assist (25%) — needs help with clothing or hygiene after",
    "Moderate assist (50%) — needs help transferring on/off toilet and with hygiene",
    "Maximum assist (75%) — caregiver provides most help, client participates partially",
    "Total dependence — caregiver manages all toileting needs",
    "Incontinence management — uses briefs/pads, scheduled toileting program",
    "Catheter care — has indwelling or intermittent catheter",
    "Colostomy/Ostomy care — requires bag emptying and skin care",
    "Bedpan/Urinal only — bedbound, unable to use toilet or commode",
  ],
  mobility:[
    "Independent — walks without assistance or devices",
    "Independent with device — uses cane independently",
    "Independent with device — uses walker independently",
    "Independent with device — uses rollator independently",
    "Supervision — safe to walk, needs someone nearby or verbal cues",
    "Contact guard assist — caregiver places hand on client for balance, no lifting",
    "Minimal assist (25%) — steady gait but occasional loss of balance",
    "Moderate assist (50%) — needs consistent hands-on support for ambulation",
    "Maximum assist (75%) — bears some weight but needs significant support",
    "Two-person assist — requires two caregivers for safe ambulation",
    "Wheelchair dependent — uses manual wheelchair, may self-propel",
    "Wheelchair dependent — uses power wheelchair",
    "Bedbound — unable to leave bed, requires repositioning q2h",
    "Transfer assist only — walks once up but needs help sit-to-stand",
    "Fall risk — ambulatory but history of falls, requires precautions",
    "Slow gait, balance issues — ambulatory with gait abnormality",
  ],
  transferring:[
    "Independent — moves in/out of bed, chair, toilet without help",
    "Independent with equipment — uses transfer board, pole, or lift independently",
    "Supervision — needs someone present during transfers for safety",
    "Standby assist — caregiver within arm's reach, no contact unless needed",
    "Minimal assist (25%) — needs steadying or light support during pivot",
    "Moderate assist (50%) — needs consistent hands-on help to stand/pivot",
    "Maximum assist (75%) — bears some weight, caregiver provides most effort",
    "Mechanical lift — Hoyer or sit-to-stand lift required",
    "Two-person assist — requires two caregivers for all transfers",
    "Total dependence — unable to participate in transfers",
    "Slide board transfer — uses transfer board between surfaces",
  ],
  continence:[
    "Continent — full bowel and bladder control",
    "Occasionally incontinent — accidents less than weekly",
    "Frequently incontinent — accidents multiple times per week",
    "Bowel continent, bladder incontinent",
    "Bladder continent, bowel incontinent",
    "Incontinent — no bowel or bladder control",
    "Managed with scheduled toileting — continent when prompted",
    "Managed with pads/briefs — wears protection",
    "Catheterized — bladder managed with catheter",
    "Colostomy/Ileostomy — bowel managed with ostomy",
  ],
  cognition:[
    "Intact — alert, oriented x4 (person, place, time, situation)",
    "Mild impairment — occasional forgetfulness, all ADLs independent",
    "Mild cognitive impairment (MCI) — diagnosed, memory lapses, judgment intact",
    "Moderate impairment — needs reminders for daily tasks, supervision recommended",
    "Moderate dementia — disoriented to time/place, needs structured routine",
    "Severe impairment — limited recognition of family, requires constant supervision",
    "Severe dementia — non-verbal or minimal verbal, total care needed",
    "Fluctuating — good days and bad days, Lewy body pattern",
    "Oriented but poor safety judgment — wanders, leaves stove on",
    "Sundowning — cognitive decline in afternoon/evening",
    "Delirium — acute confusion, medical evaluation needed",
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// SEVERITY & ACUITY DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════
const SEVERITY_DEFS={
  low:{label:"Low",desc:"No immediate risk. Document and monitor. Routine follow-up.",color:"wn"},
  medium:{label:"Medium",desc:"Potential risk to client safety or health. Requires timely response within 24 hours. Notify supervisor.",color:"er"},
  high:{label:"High",desc:"Significant risk. Immediate action required. Notify supervisor and family. MD consultation may be needed.",color:"er"},
  critical:{label:"Critical",desc:"Life-threatening or serious harm. Call 911 first. Notify all parties immediately. Full incident documentation required.",color:"er"},
};

const ACUITY_LEVELS={
  1:{label:"Level 1 — Minimal",desc:"Independent in most ADLs, companionship/light housekeeping focus. 1-3 visits/week.",hours:"4-12 hrs/week"},
  2:{label:"Level 2 — Low",desc:"Needs standby/minimal assist with 1-2 ADLs. Medication reminders. 3-5 visits/week.",hours:"12-20 hrs/week"},
  3:{label:"Level 3 — Moderate",desc:"Needs hands-on assist with multiple ADLs. Fall risk. Complex medications. Daily visits.",hours:"20-35 hrs/week"},
  4:{label:"Level 4 — High",desc:"Dependent in most ADLs. Cognitive impairment. High fall risk. Multiple chronic conditions. Daily extended visits.",hours:"35-56 hrs/week"},
  5:{label:"Level 5 — Total Care",desc:"Total dependence all ADLs. Bedbound or near-bedbound. May need 2-person assist. 24/7 or live-in care.",hours:"56+ hrs/week"},
};

// ═══════════════════════════════════════════════════════════════════════
// REFERENCE LISTS — Searchable typeahead data
// ═══════════════════════════════════════════════════════════════════════
const DX_LIST=[
  // Cardiac
  "Hypertension (HTN)","Congestive Heart Failure (CHF)","Atrial Fibrillation (AFib)","Coronary Artery Disease (CAD)","Heart Valve Disease","Cardiomyopathy","Peripheral Artery Disease (PAD)","Deep Vein Thrombosis (DVT)","Angina","Aortic Stenosis","Bradycardia","Tachycardia","Heart Murmur","Post-MI (Myocardial Infarction)","Pacemaker",
  // Neurological
  "Alzheimer's Disease","Parkinson's Disease","Dementia (unspecified)","Vascular Dementia","Lewy Body Dementia","Frontotemporal Dementia","Stroke (CVA)","TIA (Mini-Stroke)","Multiple Sclerosis (MS)","Epilepsy/Seizure Disorder","Neuropathy (Peripheral)","Diabetic Neuropathy","Essential Tremor","Traumatic Brain Injury (TBI)","Bell's Palsy","Myasthenia Gravis","ALS (Lou Gehrig's Disease)","Huntington's Disease","Normal Pressure Hydrocephalus","Post-Concussion Syndrome",
  // Respiratory
  "COPD","Emphysema","Chronic Bronchitis","Asthma","Pulmonary Fibrosis","Pneumonia (recurrent)","Sleep Apnea","Oxygen Dependent","Tracheostomy","Pleural Effusion",
  // Endocrine
  "Diabetes Mellitus Type 1","Diabetes Mellitus Type 2","Hypothyroidism","Hyperthyroidism","Adrenal Insufficiency","Osteoporosis","Cushing's Syndrome","PCOS",
  // Musculoskeletal
  "Osteoarthritis","Rheumatoid Arthritis","Gout","Osteoporosis","Hip Fracture (history)","Hip Replacement","Knee Replacement","Shoulder Replacement","Spinal Stenosis","Degenerative Disc Disease","Scoliosis","Fibromyalgia","Lupus (SLE)","Amputation (upper)","Amputation (lower/BKA)","Amputation (lower/AKA)",
  // GI
  "GERD","Crohn's Disease","Ulcerative Colitis","Diverticulitis","Celiac Disease","IBS","Liver Cirrhosis","Hepatitis B","Hepatitis C","Pancreatitis","G-tube/PEG","Dysphagia","Bowel Obstruction (history)","Colostomy","Ileostomy",
  // Renal/Urinary
  "Chronic Kidney Disease (CKD)","End-Stage Renal Disease (ESRD)","Dialysis","UTI (recurrent)","Urinary Incontinence","Urinary Retention","Kidney Stones (recurrent)","Nephrostomy","Suprapubic Catheter",
  // Psychiatric/Behavioral
  "Major Depressive Disorder","Bipolar Disorder","Generalized Anxiety Disorder","PTSD","Schizophrenia","Schizoaffective Disorder","Hoarding Disorder","Substance Use Disorder","Alcohol Use Disorder","Insomnia","Sundowning","Agitation/Behavioral Issues",
  // Cancer/Oncology
  "Breast Cancer","Lung Cancer","Prostate Cancer","Colon Cancer","Pancreatic Cancer","Leukemia","Lymphoma","Cancer (in remission)","Cancer (palliative/terminal)",
  // Visual/Hearing
  "Macular Degeneration","Glaucoma","Cataracts","Legally Blind","Hearing Loss (bilateral)","Hearing Loss (unilateral)","Cochlear Implant",
  // Other
  "Anemia","Obesity","Malnutrition/Failure to Thrive","Pressure Ulcer/Wound","Chronic Pain Syndrome","Fall Risk","Frequent Falls","DVT/PE Risk","History of Falls","Contractures","Edema (lower extremity)","Lymphedema","Decubitus Ulcer","Sepsis (history)","COVID-19 Long Haul","Hospice/Palliative","Do Not Resuscitate (DNR)","POLST on File",
];

const MED_LIST=[
  // Cardiac/BP
  "Lisinopril 5mg","Lisinopril 10mg","Lisinopril 20mg","Amlodipine 5mg","Amlodipine 10mg","Metoprolol Tartrate 25mg","Metoprolol Tartrate 50mg","Metoprolol Succinate 25mg ER","Metoprolol Succinate 50mg ER","Losartan 25mg","Losartan 50mg","Losartan 100mg","Atenolol 25mg","Atenolol 50mg","Furosemide (Lasix) 20mg","Furosemide (Lasix) 40mg","Hydrochlorothiazide 12.5mg","Hydrochlorothiazide 25mg","Spironolactone 25mg","Digoxin 0.125mg","Digoxin 0.25mg","Carvedilol 6.25mg","Carvedilol 12.5mg","Hydralazine 25mg","Isosorbide Mononitrate 30mg ER","Nitroglycerin 0.4mg SL PRN",
  // Blood Thinners
  "Warfarin (Coumadin) 1mg","Warfarin (Coumadin) 2mg","Warfarin (Coumadin) 5mg","Eliquis (Apixaban) 2.5mg","Eliquis (Apixaban) 5mg","Xarelto (Rivaroxaban) 10mg","Xarelto (Rivaroxaban) 20mg","Aspirin 81mg","Aspirin 325mg","Plavix (Clopidogrel) 75mg",
  // Diabetes
  "Metformin 500mg","Metformin 1000mg","Metformin 500mg ER","Glipizide 5mg","Glipizide 10mg","Insulin Glargine (Lantus)","Insulin Lispro (Humalog)","Insulin Aspart (NovoLog)","Insulin NPH","Jardiance (Empagliflozin) 10mg","Jardiance 25mg","Ozempic (Semaglutide) 0.5mg","Ozempic 1mg","Trulicity (Dulaglutide) 0.75mg","Farxiga (Dapagliflozin) 10mg",
  // Cholesterol
  "Atorvastatin 10mg","Atorvastatin 20mg","Atorvastatin 40mg","Atorvastatin 80mg","Rosuvastatin 5mg","Rosuvastatin 10mg","Rosuvastatin 20mg","Simvastatin 20mg","Simvastatin 40mg","Pravastatin 40mg","Ezetimibe 10mg","Fenofibrate 145mg",
  // Pain
  "Acetaminophen (Tylenol) 500mg","Ibuprofen 200mg","Ibuprofen 400mg","Ibuprofen 600mg","Naproxen 250mg","Naproxen 500mg","Gabapentin 100mg","Gabapentin 300mg","Gabapentin 600mg","Pregabalin (Lyrica) 75mg","Tramadol 50mg","Hydrocodone/APAP 5/325mg","Oxycodone 5mg","Morphine Sulfate 15mg ER","Lidocaine Patch 5%","Duloxetine (Cymbalta) 30mg","Duloxetine 60mg","Meloxicam 7.5mg","Meloxicam 15mg","Diclofenac Gel 1%",
  // Neurological/Parkinson's
  "Carbidopa-Levodopa 25/100mg","Carbidopa-Levodopa 25/250mg","Carbidopa-Levodopa CR 25/100mg","Pramipexole 0.25mg","Pramipexole 0.5mg","Ropinirole 0.5mg","Ropinirole 1mg","Entacapone 200mg","Amantadine 100mg","Donepezil (Aricept) 5mg","Donepezil 10mg","Memantine (Namenda) 10mg","Rivastigmine Patch 4.6mg","Rivastigmine Patch 9.5mg","Levetiracetam (Keppra) 500mg","Phenytoin (Dilantin) 100mg","Carbamazepine 200mg","Valproic Acid 250mg",
  // Psychiatric
  "Sertraline (Zoloft) 50mg","Sertraline 100mg","Escitalopram (Lexapro) 10mg","Escitalopram 20mg","Fluoxetine (Prozac) 20mg","Citalopram (Celexa) 20mg","Paroxetine (Paxil) 20mg","Trazodone 50mg","Trazodone 100mg","Mirtazapine 15mg","Mirtazapine 30mg","Buspirone 10mg","Lorazepam (Ativan) 0.5mg","Lorazepam 1mg","Alprazolam (Xanax) 0.25mg","Clonazepam (Klonopin) 0.5mg","Quetiapine (Seroquel) 25mg","Quetiapine 50mg","Olanzapine (Zyprexa) 5mg","Risperidone 0.5mg","Risperidone 1mg","Haloperidol 0.5mg","Lithium 300mg",
  // GI
  "Omeprazole (Prilosec) 20mg","Omeprazole 40mg","Pantoprazole (Protonix) 40mg","Famotidine (Pepcid) 20mg","Docusate Sodium (Colace) 100mg","Senna 8.6mg","Polyethylene Glycol (MiraLAX)","Ondansetron (Zofran) 4mg","Metoclopramide 10mg","Lactulose 15mL","Sucralfate 1g",
  // Respiratory
  "Albuterol Inhaler (ProAir) PRN","Fluticasone Inhaler (Flovent)","Tiotropium (Spiriva)","Budesonide/Formoterol (Symbicort)","Fluticasone/Salmeterol (Advair)","Montelukast (Singulair) 10mg","Prednisone 5mg","Prednisone 10mg","Prednisone 20mg","Dexamethasone 4mg",
  // Thyroid
  "Levothyroxine 25mcg","Levothyroxine 50mcg","Levothyroxine 75mcg","Levothyroxine 88mcg","Levothyroxine 100mcg","Levothyroxine 112mcg","Levothyroxine 125mcg","Methimazole 5mg",
  // Supplements/Other
  "Calcium + Vitamin D 600/400","Vitamin D3 1000 IU","Vitamin D3 2000 IU","Vitamin D3 5000 IU","Vitamin B12 1000mcg","Iron (Ferrous Sulfate) 325mg","Folic Acid 1mg","Magnesium Oxide 400mg","Potassium Chloride 20mEq","Fish Oil 1000mg","Multivitamin Daily","CoQ10 100mg","Melatonin 3mg","Melatonin 5mg","Cranberry Extract 500mg",
  // Topical/Eye
  "Timolol Eye Drops 0.5%","Latanoprost Eye Drops","Artificial Tears PRN","Erythromycin Eye Ointment","Silver Sulfadiazine Cream","Mupirocin Ointment 2%","Triamcinolone Cream 0.1%","Ketoconazole Cream 2%","Nystatin Powder",
  // Urinary
  "Tamsulosin (Flomax) 0.4mg","Finasteride 5mg","Oxybutynin 5mg","Tolterodine (Detrol) 2mg",
];

const INTERESTS_LIST=[
  // Arts & Crafts
  "Painting","Watercolors","Drawing/Sketching","Knitting","Crocheting","Quilting","Sewing","Needlepoint","Cross-stitch","Pottery","Ceramics","Scrapbooking","Card making","Flower arranging","Woodworking","Model building","Calligraphy","Photography","Coloring books","Origami","Jewelry making","Weaving","Embroidery",
  // Music
  "Classical music","Jazz music","Gospel music","Country music","Oldies/Motown","Opera","Blues","Big band/Swing","Playing piano","Playing guitar","Playing harmonica","Singing","Church choir","Listening to vinyl records","Music therapy",
  // Games & Puzzles
  "Crossword puzzles","Jigsaw puzzles","Sudoku","Word search","Bridge club","Poker","Pinochle","Canasta","Rummy","Chess","Checkers","Dominoes","Bingo","Trivia games","Board games","Mahjong","Solitaire",
  // Reading & Writing
  "Reading mystery novels","Reading romance novels","Reading historical fiction","Reading biographies","Reading newspapers","Reading large-print books","Audiobooks","Poetry","Writing letters","Journaling","Memoir writing","Book club","Reading scripture/religious texts","Reading magazines",
  // Nature & Outdoors
  "Gardening","Bird watching","Nature walks","Fishing","Flower gardening","Vegetable gardening","Visiting parks","Feeding birds","Sitting on porch/patio","Watching sunsets","Picnics","Visiting botanical gardens","Indoor plants/terrariums",
  // Social & Community
  "Church/synagogue/mosque attendance","Bible study","Prayer groups","Volunteering","Senior center activities","Visiting with friends","Phone calls with family","Video calls with grandchildren","Community events","Potlucks","Holiday celebrations","Tea/coffee with friends","Mentoring/tutoring",
  // Exercise & Movement
  "Chair exercises","Walking","Swimming","Water aerobics","Tai chi","Gentle yoga","Stretching","Balance exercises","Dancing","Line dancing","Ballroom dancing","Wii bowling/sports","Physical therapy exercises","Resistance bands","Seated cycling",
  // Food & Cooking
  "Cooking","Baking","Cake decorating","Trying new recipes","Watching cooking shows","Meal planning","Canning/preserving","Making soup","Baking bread","Making cookies for neighbors","Sharing family recipes","Wine appreciation","Tea ceremony",
  // Entertainment
  "Watching old movies","Watching Cubs games","Watching Bears games","Watching White Sox games","Watching Bulls games","Watching Blackhawks games","Watching game shows","Watching documentaries","Watching nature programs","Watching news","Watching Jeopardy","Watching Wheel of Fortune","Watching cooking shows","Watching soap operas","Listening to radio","Listening to podcasts",
  // History & Culture
  "Visiting museums","Art galleries","Historical lectures","Genealogy research","Collecting stamps","Collecting coins","Collecting figurines","Antiques","Learning languages","Cultural festivals","Travel stories/memories",
  // Pets & Animals
  "Dog companionship","Cat companionship","Visiting pet therapy animals","Watching wildlife","Aquarium/fish","Visiting farm animals",
  // Technology
  "FaceTime with family","Social media (Facebook)","Email correspondence","Looking at family photos online","Using tablet/iPad","Online shopping","Watching YouTube","Video chatting with grandchildren",
];

// ═══════════════════════════════════════════════════════════════════════
// TYPEAHEAD INPUT COMPONENT
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// CARE NOTE DOCUMENTATION FRAMEWORK — 16 Categories
// ═══════════════════════════════════════════════════════════════════════
const NOTE_CATS={
  "ADLs":{icon:"🛁",color:"tag-bl",desc:"Activities of Daily Living",fields:[
    {key:"bathing",label:"Bathing",type:"select",opts:["Independent","Standby assist","Minimal assist","Moderate assist","Maximum assist","Not performed today"]},
    {key:"dressing",label:"Dressing",type:"select",opts:["Independent","Standby assist","Minimal assist","Moderate assist","Maximum assist","Not performed today"]},
    {key:"grooming",label:"Grooming",type:"select",opts:["Independent","Standby assist","Minimal assist","Moderate assist","Not performed today"]},
    {key:"toileting",label:"Toileting",type:"select",opts:["Independent","Standby assist","Minimal assist","Moderate assist","Maximum assist","Not applicable"]},
    {key:"transferring",label:"Transferring",type:"select",opts:["Independent","Standby assist","Minimal assist","Moderate assist","Mechanical lift","Not applicable"]},
    {key:"mobility",label:"Mobility/Walking",type:"select",opts:["Independent","With device","Standby assist","Hands-on assist","Wheelchair","Bedbound"]},
    {key:"eating",label:"Eating",type:"select",opts:["Independent","Setup assist","Minimal assist","Moderate assist","Fed by caregiver","Tube feeding"]},
    {key:"baseline",label:"Change from baseline",type:"select",opts:["Improved","Stable","Declined"]},
  ]},
  "IADLs":{icon:"🏠",color:"tag-bl",desc:"Instrumental Activities",fields:[
    {key:"meals",label:"Meal preparation",type:"check"},
    {key:"shopping",label:"Shopping/errands",type:"check"},
    {key:"housekeeping",label:"Housekeeping/laundry",type:"check"},
    {key:"transport",label:"Transportation",type:"check"},
    {key:"medReminders",label:"Medication reminders",type:"check"},
    {key:"appointments",label:"Appointment coordination",type:"check"},
    {key:"completedVsPlanned",label:"Tasks completed vs planned",type:"text",placeholder:"e.g. 5 of 6 planned tasks completed"},
    {key:"timeSpent",label:"Time spent (minutes)",type:"number"},
    {key:"issues",label:"Issues / deviations",type:"text",placeholder:"Any problems encountered"},
  ]},
  "Nutrition":{icon:"🍽",color:"tag-ok",desc:"Nutrition & Hydration",fields:[
    {key:"mealsPrepared",label:"Meals prepared",type:"text",placeholder:"e.g. Breakfast, lunch"},
    {key:"consumption",label:"Meals consumed",type:"select",opts:["Full meal","Partial (>50%)","Partial (<50%)","Refused","N/A"]},
    {key:"fluids",label:"Fluid intake",type:"select",opts:["Adequate","Low","Refused fluids","Encouraged fluids"]},
    {key:"appetite",label:"Appetite",type:"select",opts:["Good","Fair","Poor","No appetite","Increased"]},
    {key:"weightObs",label:"Weight observation",type:"text",placeholder:"If known (non-clinical)"},
    {key:"foodAvail",label:"Food availability in home",type:"select",opts:["Adequate","Low - needs shopping","Inadequate - notify office"]},
  ]},
  "Personal Care":{icon:"🧼",color:"tag-bl",desc:"Personal Care & Hygiene",fields:[
    {key:"bathComplete",label:"Bathing completed",type:"select",opts:["Full bath/shower","Sponge bath","Partial","Declined","Not scheduled"]},
    {key:"oralCare",label:"Oral care",type:"select",opts:["Completed","Assisted","Declined","Not scheduled"]},
    {key:"grooming",label:"Grooming (hair, nails)",type:"select",opts:["Completed","Assisted","Declined","Not scheduled"]},
    {key:"incontinence",label:"Incontinence care",type:"select",opts:["N/A","Brief changed","Skin cleaned","Scheduled toileting","Accident managed"]},
    {key:"skinObs",label:"Skin observations",type:"text",placeholder:"Redness, irritation, pressure areas..."},
    {key:"hygieneConcerns",label:"Hygiene concerns",type:"text",placeholder:"Any concerns to document"},
  ]},
  "Elimination":{icon:"🚻",color:"tag-wn",desc:"Elimination Tracking",fields:[
    {key:"bowel",label:"Bowel movement",type:"select",opts:["Normal","Irregular","Constipation reported","Diarrhea","Not reported"]},
    {key:"urination",label:"Urination patterns",type:"select",opts:["Normal","Increased frequency","Decreased output","Incontinence episode","Pain/burning reported"]},
    {key:"obsNotes",label:"Observations (non-clinical)",type:"text",placeholder:"Document observations only"},
  ]},
  "Mobility":{icon:"🚶",color:"tag-bl",desc:"Mobility & Physical Activity",fields:[
    {key:"exercise",label:"Exercise routine completed",type:"select",opts:["Full routine","Partial","Declined","Not scheduled"]},
    {key:"walking",label:"Walking/movement",type:"select",opts:["Active - walked independently","Walked with assist","Chair exercises only","Minimal movement","Bedbound"]},
    {key:"rom",label:"Range of motion support",type:"select",opts:["Completed","Partial","Declined","Not scheduled"]},
    {key:"balance",label:"Stability/balance",type:"select",opts:["Steady","Slightly unsteady","Unsteady - close supervision","Near fall observed","Fall occurred"]},
    {key:"difficulties",label:"Movement difficulties noted",type:"text",placeholder:"Any new difficulties"},
  ]},
  "Cognitive":{icon:"🧠",color:"tag-pu",desc:"Cognitive & Behavioral",fields:[
    {key:"orientation",label:"Orientation",type:"select",opts:["Oriented x4 (normal)","Mild confusion","Moderate confusion","Severely disoriented","Fluctuating"]},
    {key:"memory",label:"Memory issues",type:"select",opts:["None observed","Mild (repeated questions)","Moderate (forgot meals/meds)","Significant (didn't recognize caregiver)"]},
    {key:"behavior",label:"Behavioral changes",type:"select",opts:["None","Agitation","Withdrawal","Wandering attempt","Verbal aggression","Sundowning","Paranoia/delusions"]},
    {key:"communication",label:"Communication",type:"select",opts:["Normal","Slightly impaired","Difficulty finding words","Minimal verbal","Non-verbal"]},
    {key:"baselineChange",label:"Change from baseline",type:"select",opts:["No change","Improved","Declined slightly","Declined significantly"]},
    {key:"triggers",label:"Triggers/patterns observed",type:"text",placeholder:"What preceded any changes"},
  ]},
  "Emotional":{icon:"💛",color:"tag-wn",desc:"Emotional & Social Well-being",fields:[
    {key:"mood",label:"Mood",type:"select",opts:["Positive/happy","Neutral/calm","Anxious","Sad/tearful","Irritable","Flat/withdrawn"]},
    {key:"engagement",label:"Engagement level",type:"select",opts:["Actively engaged","Moderately engaged","Passive","Disengaged","Resistant"]},
    {key:"social",label:"Social interaction",type:"select",opts:["Had visitors","Phone/video calls","Outing/activity","No interaction today","Declined interaction"]},
    {key:"isolation",label:"Signs of isolation",type:"select",opts:["None","Mentioned loneliness","Declined activities","No contact with family/friends","Concern - notify office"]},
  ]},
  "Safety":{icon:"🏡",color:"tag-er",desc:"Safety & Home Environment",fields:[
    {key:"fallHazards",label:"Fall hazards",type:"select",opts:["None identified","Clutter/rugs","Wet floors","Poor lighting","Cords/wires","New hazard - addressed","New hazard - needs follow-up"]},
    {key:"bathroom",label:"Bathroom safety",type:"select",opts:["Adequate","Grab bars needed","Non-slip mat needed","Good setup"]},
    {key:"cleanliness",label:"General cleanliness",type:"select",opts:["Clean","Acceptable","Needs attention","Safety concern"]},
    {key:"accessibility",label:"Accessibility issues",type:"text",placeholder:"Any access problems noted"},
    {key:"newRisks",label:"New risks identified",type:"text",placeholder:"Describe any new risks"},
    {key:"risksResolved",label:"Risks resolved",type:"text",placeholder:"What was fixed"},
  ]},
  "Routine":{icon:"📋",color:"tag-bl",desc:"Routine Integrity & Compliance",fields:[
    {key:"tasksPlanned",label:"Tasks planned",type:"number",placeholder:"How many"},
    {key:"tasksCompleted",label:"Tasks completed",type:"number",placeholder:"How many"},
    {key:"missedTasks",label:"Missed tasks (with reason)",type:"text",placeholder:"What was missed and why"},
    {key:"refusals",label:"Client refusals",type:"text",placeholder:"What was refused"},
    {key:"schedule",label:"Schedule adherence",type:"select",opts:["On time","Slightly late","Significantly late","Adjusted by client request"]},
  ]},
  "Observations":{icon:"👁",color:"tag-er",desc:"Observation & Change Detection",fields:[
    {key:"appetite",label:"Appetite changes",type:"select",opts:["No change","Increased","Decreased","Refused food"]},
    {key:"energy",label:"Energy level",type:"select",opts:["Normal","Higher than usual","Lower than usual","Very fatigued","Lethargic"]},
    {key:"mobilityChange",label:"Mobility changes",type:"select",opts:["No change","Improved","Slightly declined","Significantly declined"]},
    {key:"physical",label:"Physical signs",type:"text",placeholder:"Bruising, swelling, discomfort, skin changes..."},
    {key:"sleep",label:"Sleep pattern changes",type:"select",opts:["Normal","Difficulty sleeping","Sleeping more","Nighttime waking","Client reports poor sleep"]},
    {key:"severity",label:"Severity of changes",type:"select",opts:["Minor","Moderate","Significant - notify office"]},
    {key:"newVsOngoing",label:"New vs ongoing",type:"select",opts:["New observation","Ongoing - stable","Ongoing - worsening","Ongoing - improving"]},
  ]},
  "Escalations":{icon:"📞",color:"tag-er",desc:"Escalations & Communication",fields:[
    {key:"issue",label:"Issue identified",type:"text",placeholder:"Describe the issue"},
    {key:"notified",label:"Who was notified",type:"text",placeholder:"Family, supervisor, MD..."},
    {key:"timeOfEsc",label:"Time of escalation",type:"text",placeholder:"e.g. 2:30 PM"},
    {key:"response",label:"Response received",type:"text",placeholder:"What was the guidance"},
    {key:"followUp",label:"Follow-up status",type:"select",opts:["Pending","In progress","Resolved","Escalated further"]},
    {key:"resolution",label:"Resolution outcome",type:"text",placeholder:"How was it resolved"},
  ]},
  "Transportation":{icon:"🚗",color:"tag-bl",desc:"Transportation & External",fields:[
    {key:"purpose",label:"Trip purpose",type:"select",opts:["Medical appointment","Pharmacy","Grocery shopping","Errands","Social outing","Religious service","Other"]},
    {key:"timeliness",label:"Timeliness",type:"select",opts:["On time","Late (traffic)","Late (client not ready)","Cancelled"]},
    {key:"support",label:"Support required",type:"select",opts:["Independent","Minimal (door-to-door)","Wheelchair assist","Full assist"]},
    {key:"issues",label:"Issues encountered",type:"text",placeholder:"Any problems during transport"},
  ]},
  "Visit Verification":{icon:"✅",color:"tag-ok",desc:"Visit Verification & Performance",fields:[
    {key:"clockIn",label:"Clock-in (GPS verified)",type:"select",opts:["On time","Late (<15 min)","Late (>15 min)","GPS verified","GPS mismatch"]},
    {key:"tasksComplete",label:"Tasks completed",type:"select",opts:["All tasks","Most tasks","Some tasks","Few tasks"]},
    {key:"docComplete",label:"Documentation completeness",type:"select",opts:["Full documentation","Partial","Needs follow-up"]},
    {key:"clientFeedback",label:"Client feedback",type:"text",placeholder:"Any verbal feedback from client"},
    {key:"supervisorFlags",label:"Supervisor review flags",type:"text",placeholder:"Items needing review"},
  ]},
  "Incidents":{icon:"⚠️",color:"tag-er",desc:"Incidents & Exceptions",fields:[
    {key:"type",label:"Incident type",type:"select",opts:["Fall","Near fall","Injury","Medication issue observed","Refusal of care","Missed visit","Equipment failure","Other"]},
    {key:"details",label:"Incident details",type:"text",placeholder:"Describe in detail"},
    {key:"actionsTaken",label:"Actions taken",type:"text",placeholder:"What you did"},
    {key:"notifications",label:"Notifications completed",type:"text",placeholder:"Who was contacted"},
  ]},
  "General":{icon:"📝",color:"tag-ok",desc:"General Note",fields:[]},
};

function TypeaheadInput({list,placeholder,onSelect,existing=[]}){
  const [q,setQ]=useState("");
  const [focused,setFocused]=useState(false);
  const filtered=q.length>=2?list.filter(i=>i.toLowerCase().includes(q.toLowerCase())&&!existing.includes(i)).slice(0,8):[];
  return <div style={{position:"relative"}}>
    <div style={{display:"flex",gap:6}}>
      <input value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),200)} placeholder={placeholder} style={{flex:1,padding:"8px 10px",border:"var(--border-thin)",fontSize:12,fontFamily:"var(--f)"}}/>
      <button className="btn btn-sm btn-p" onClick={()=>{if(q.trim()){onSelect(q.trim());setQ("");}}} disabled={!q.trim()}>+</button>
    </div>
    {focused&&filtered.length>0&& <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:20,background:"var(--card)",border:"var(--border-thin)",maxHeight:240,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.12)"}}>
      {filtered.map((item,i)=> <div key={i} onMouseDown={()=>{onSelect(item);setQ("");}} style={{padding:"8px 12px",fontSize:12,cursor:"pointer",borderBottom:"var(--border-thin)"}} onMouseEnter={e=>e.target.style.background="rgba(0,0,0,.03)"} onMouseLeave={e=>e.target.style.background=""}>{item}</div>)}
    </div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// PROFILE AVATAR — Shows photo or initials fallback
// ═══════════════════════════════════════════════════════════════════════
function ProfileAvatar({name,photo,size=48,dark=false}){
  const initials=name?.split(" ").map(n=>n[0]).join("")||"?";
  if(photo) return <img src={photo} alt={name} style={{width:size,height:size,objectFit:"cover",border:"var(--border-thin)",flexShrink:0}}/>;
  return <div style={{width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center",background:dark?"#111":"var(--bg)",color:dark?"#fff":"var(--text)",fontFamily:"var(--fd)",fontSize:size*.35,fontWeight:400,flexShrink:0,border:"var(--border-thin)"}}>{initials}</div>;
}

// ═══════════════════════════════════════════════════════════════════════
// PHOTO UPLOAD — Converts to base64 for storage
// ═══════════════════════════════════════════════════════════════════════
function PhotoUpload({currentPhoto,onUpload,label="Upload photo",entityType="client",entityId="unknown",compact=false}){
  const fileRef=useRef(null);
  const [uploading,setUploading]=useState(false);
  const handleFile=async(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    if(!file.type.startsWith("image/")){alert("Please select an image file");return;}
    if(file.size>5*1024*1024){alert("Image must be under 5MB");return;}
    setUploading(true);
    // Create resized version
    const reader=new FileReader();
    reader.onload=async(ev)=>{
      const img=new Image();
      img.onload=async()=>{
        const canvas=document.createElement("canvas");
        const max=200;
        let w=img.width,h=img.height;
        if(w>h){if(w>max){h=h*(max/w);w=max;}}else{if(h>max){w=w*(max/h);h=max;}}
        canvas.width=w;canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        const base64=canvas.toDataURL("image/jpeg",0.8);
        // Try uploading to Supabase Storage
        const publicUrl=await sbUploadBase64(base64,entityType,entityId);
        if(publicUrl){
          onUpload(publicUrl);
        }else{
          // Fallback to base64 if Supabase upload fails
          onUpload(base64);
        }
        setUploading(false);
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  // Compact mode - just buttons, no photo preview
  if(compact){
    return <div style={{display:"flex",gap:4}}>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
      <button className="btn btn-sm btn-s" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>fileRef.current?.click()} disabled={uploading}>{uploading?"⏳":currentPhoto?"📷 Change":"📷 Upload"}</button>
      {currentPhoto&&<button className="btn btn-sm btn-s" style={{fontSize:10,padding:"3px 8px",color:"var(--err)"}} onClick={()=>onUpload(null)}>✕</button>}
    </div>;
  }
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
    {currentPhoto? <img src={currentPhoto} alt="Profile" style={{width:80,height:80,objectFit:"cover",border:"var(--border-thin)"}}/>
    : <div style={{width:80,height:80,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",border:"2px dashed var(--bdr)",fontSize:10,color:"var(--t2)",textAlign:"center",padding:8}}>No photo</div>}
    <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
    <button className="btn btn-sm btn-s" onClick={()=>fileRef.current?.click()} disabled={uploading}>{uploading?"Uploading...":currentPhoto?"Change":"Upload"}</button>
    {currentPhoto&&<button className="btn btn-sm btn-s" style={{fontSize:10,color:"var(--err)"}} onClick={()=>onUpload(null)}>Remove</button>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// AI CLINICAL AGENT — Acuity scoring, action recommendations
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// REFERRAL FORM — Shared by Client, Caregiver, and Family portals
// ═══════════════════════════════════════════════════════════════════════
function ReferralForm({referrerName,referrerRole,onReferCG,onReferClient}){
  const [type,setType]=useState("client");
  const [submitted,setSubmitted]=useState(false);
  const [cgForm,setCgForm]=useState({name:"",phone:"",email:"",experience:"",certs:"",availability:"Full-time",notes:""});
  const [clForm,setClForm]=useState({name:"",phone:"",age:"",needs:"",hoursNeeded:"",urgency:"medium",contactName:"",contactPhone:"",notes:""});

  const submitCG=()=>{
    if(!cgForm.name.trim())return;
    onReferCG&&onReferCG({
      id:"AP"+Math.random().toString(36).slice(2,9),name:cgForm.name,email:cgForm.email,phone:cgForm.phone,
      certs:cgForm.certs?cgForm.certs.split(",").map(c=>c.trim()).filter(Boolean):[],
      experience:cgForm.experience,availability:cgForm.availability,preferredAreas:[],
      status:"new",appliedDate:new Date().toISOString().slice(0,10),bgCheck:"not_started",
      source:"Referral ("+referrerName+")",notes:cgForm.notes,score:null,
      activityLog:[{date:new Date().toISOString(),text:"Referred by "+referrerName+" ("+referrerRole+")"}]
    });
    setSubmitted(true);setTimeout(()=>{setSubmitted(false);setCgForm({name:"",phone:"",email:"",experience:"",certs:"",availability:"Full-time",notes:""});},3000);
  };
  const submitCL=()=>{
    if(!clForm.name.trim())return;
    onReferClient&&onReferClient({
      id:"LD"+Math.random().toString(36).slice(2,9),name:clForm.name,phone:clForm.phone,age:parseInt(clForm.age)||"",
      email:"",referralSource:"Referral ("+referrerName+" — "+referrerRole+")",needs:clForm.needs,
      hoursNeeded:clForm.hoursNeeded,status:"new",assessmentDate:"",urgency:clForm.urgency,
      notes:(clForm.contactName?"Primary contact: "+clForm.contactName+(clForm.contactPhone?" "+clForm.contactPhone:"")+". ":"")+clForm.notes,
      activityLog:[{date:new Date().toISOString(),text:"Referred by "+referrerName+" ("+referrerRole+")"}]
    });
    setSubmitted(true);setTimeout(()=>{setSubmitted(false);setClForm({name:"",phone:"",age:"",needs:"",hoursNeeded:"",urgency:"medium",contactName:"",contactPhone:"",notes:""});},3000);
  };

  if(submitted)return <div className="ai-card" style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:8}}>🎉</div><h4>Thank You for Your Referral!</h4><p>Our team will review this referral and follow up shortly. You're helping grow the CWIN family!</p></div>;

  return <div>
    <div className="ai-card"><h4>📣 Refer Someone to CWIN At Home</h4><p>Know someone who needs care or wants to provide care? Submit a referral below. Our team will follow up within 24 hours. Referrals are the best way to grow our community!</p></div>
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      <button className={`btn btn-sm ${type==="client"?"btn-p":"btn-s"}`} onClick={()=>setType("client")}>🏠 Refer a Client (someone who needs care)</button>
      <button className={`btn btn-sm ${type==="caregiver"?"btn-p":"btn-s"}`} onClick={()=>setType("caregiver")}>👩‍⚕️ Refer a Caregiver (someone who gives care)</button>
    </div>

    {type==="client"&& <div className="card card-b">
      <div className="card-h"><h3>🏠 Client Referral</h3></div>
      <div style={{padding:"16px 20px"}}>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Person's Name *</label><input value={clForm.name} onChange={e=>setClForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Dorothy Martinez"/></div>
          <div className="fi"><label>Age</label><input type="number" value={clForm.age} onChange={e=>setClForm(p=>({...p,age:e.target.value}))} placeholder="e.g. 81"/></div>
        </div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Phone</label><input value={clForm.phone} onChange={e=>setClForm(p=>({...p,phone:e.target.value}))} placeholder="312-555-0000"/></div>
          <div className="fi"><label>Urgency</label><select value={clForm.urgency} onChange={e=>setClForm(p=>({...p,urgency:e.target.value}))}><option value="low">Low — No rush</option><option value="medium">Medium — Within a week</option><option value="high">High — Immediate need</option></select></div>
        </div>
        <div className="fi" style={{marginBottom:12}}><label>What kind of care do they need?</label><textarea value={clForm.needs} onChange={e=>setClForm(p=>({...p,needs:e.target.value}))} rows={2} style={{width:"100%"}} placeholder="e.g. Post-surgery recovery, daily ADL assistance, companionship"/></div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Hours Needed</label><input value={clForm.hoursNeeded} onChange={e=>setClForm(p=>({...p,hoursNeeded:e.target.value}))} placeholder="e.g. 4 hours/day, 3 days/week"/></div>
        </div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Best Contact Person</label><input value={clForm.contactName} onChange={e=>setClForm(p=>({...p,contactName:e.target.value}))} placeholder="e.g. Maria (daughter)"/></div>
          <div className="fi"><label>Contact Phone</label><input value={clForm.contactPhone} onChange={e=>setClForm(p=>({...p,contactPhone:e.target.value}))} placeholder="312-555-0001"/></div>
        </div>
        <div className="fi" style={{marginBottom:12}}><label>Anything else we should know?</label><textarea value={clForm.notes} onChange={e=>setClForm(p=>({...p,notes:e.target.value}))} rows={2} style={{width:"100%"}}/></div>
        <button className="btn btn-p" style={{width:"100%"}} disabled={!clForm.name.trim()} onClick={submitCL}>Submit Client Referral</button>
      </div>
    </div>}

    {type==="caregiver"&& <div className="card card-b">
      <div className="card-h"><h3>👩‍⚕️ Caregiver Referral</h3></div>
      <div style={{padding:"16px 20px"}}>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Person's Name *</label><input value={cgForm.name} onChange={e=>setCgForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Diana Rodriguez"/></div>
          <div className="fi"><label>Phone</label><input value={cgForm.phone} onChange={e=>setCgForm(p=>({...p,phone:e.target.value}))} placeholder="312-555-0000"/></div>
        </div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Email</label><input value={cgForm.email} onChange={e=>setCgForm(p=>({...p,email:e.target.value}))} placeholder="diana@email.com"/></div>
          <div className="fi"><label>Availability</label><select value={cgForm.availability} onChange={e=>setCgForm(p=>({...p,availability:e.target.value}))}><option>Full-time</option><option>Part-time</option><option>Weekends</option><option>Flexible</option></select></div>
        </div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Certifications</label><input value={cgForm.certs} onChange={e=>setCgForm(p=>({...p,certs:e.target.value}))} placeholder="e.g. CNA, CPR/BLS, HHA (comma separated)"/></div>
          <div className="fi"><label>Experience</label><input value={cgForm.experience} onChange={e=>setCgForm(p=>({...p,experience:e.target.value}))} placeholder="e.g. 3 years home care"/></div>
        </div>
        <div className="fi" style={{marginBottom:12}}><label>Why would they be a good fit?</label><textarea value={cgForm.notes} onChange={e=>setCgForm(p=>({...p,notes:e.target.value}))} rows={2} style={{width:"100%"}}/></div>
        <button className="btn btn-p" style={{width:"100%"}} disabled={!cgForm.name.trim()} onClick={submitCG}>Submit Caregiver Referral</button>
      </div>
    </div>}
  </div>;
}

function ClinicalAgent({cl,incidents,careNotes}){
  const dxCount=cl.dx.length;
  const medCount=cl.meds.length;
  const highRiskDx=cl.dx.filter(d=>/(CHF|Heart Failure|COPD|Dialysis|Cancer|Hospice|ALS|Fall|Stroke|Dementia|Alzheimer|Parkinson)/i.test(d));
  const adlDep=Object.values(cl.adl).filter(v=>/(Moderate|Maximum|Total|Dependent|Bedbound|Severe)/i.test(v)).length;
  const adlTotal=Object.keys(cl.adl).length;
  const recentInc=incidents.filter(i=>i.clientId===cl.id).slice(0,5);
  const openInc=recentInc.filter(i=>i.status==="open").length;
  const cogImpaired=cl.adl.cognition&&/(Moderate|Severe|dementia|Fluctuating|Sundowning)/i.test(cl.adl.cognition);

  // Acuity calculation
  let acuity=1;
  if(dxCount>=3)acuity++;if(highRiskDx.length>=2)acuity++;if(adlDep>=3)acuity++;if(adlDep>=5)acuity++;
  if(medCount>=8)acuity++;if(cogImpaired)acuity++;if(openInc>0)acuity++;
  acuity=Math.min(acuity,5);
  const lvl=ACUITY_LEVELS[acuity];

  // Medication interactions/flags
  const hasBT=cl.meds.some(m=>{const n=typeof m==="string"?m:m.name||"";return /(Warfarin|Eliquis|Xarelto|Plavix|Aspirin)/i.test(n);});
  const hasInsulin=cl.meds.some(m=>{const n=typeof m==="string"?m:m.name||"";return /Insulin/i.test(n);});
  const hasPark=cl.meds.some(m=>{const n=typeof m==="string"?m:m.name||"";return /Carbidopa|Levodopa|Pramipexole/i.test(n);});
  const hasPsych=cl.meds.some(m=>{const n=typeof m==="string"?m:m.name||"";return /(Lorazepam|Alprazolam|Clonazepam|Quetiapine|Haloperidol)/i.test(n);});

  return <div className="ai-card" style={{background:"linear-gradient(135deg,#0a0a0a,#1a0a0a)"}}>
    <h4><span className="pulse" style={{background:acuity>=4?"#7a3030":acuity>=3?"#8a7356":"#3c4f3d"}}/>Clinical Agent — {cl.name}</h4>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,margin:"12px 0"}}>
      <div style={{padding:10,background:"rgba(255,255,255,.06)",textAlign:"center"}}><div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1,opacity:.4}}>Acuity</div><div style={{fontFamily:"var(--fd)",fontSize:24,fontWeight:400,color:acuity>=4?"#ff6b6b":acuity>=3?"#ffa94d":"#69db7c"}}>{acuity}</div></div>
      <div style={{padding:10,background:"rgba(255,255,255,.06)",textAlign:"center"}}><div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1,opacity:.4}}>Diagnoses</div><div style={{fontSize:18,fontWeight:600}}>{dxCount}</div></div>
      <div style={{padding:10,background:"rgba(255,255,255,.06)",textAlign:"center"}}><div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1,opacity:.4}}>Medications</div><div style={{fontSize:18,fontWeight:600}}>{medCount}</div></div>
      <div style={{padding:10,background:"rgba(255,255,255,.06)",textAlign:"center"}}><div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1,opacity:.4}}>ADL Assist</div><div style={{fontSize:18,fontWeight:600}}>{adlDep}/{adlTotal}</div></div>
    </div>
    <p style={{fontSize:11,opacity:.6,lineHeight:1.7}}>
      <strong style={{opacity:1}}>Acuity {acuity}: {lvl?.label?.split(" — ")[1]}</strong> — {lvl?.desc} Recommended: {lvl?.hours}.
      {highRiskDx.length>0&&` High-risk conditions: ${highRiskDx.join(", ")}. Ensure care plan addresses these specifically.`}
      {hasBT&&" ⚠️ BLOOD THINNER: Monitor for bruising, bleeding, falls. Ensure INR monitoring if on Warfarin."}
      {hasInsulin&&" ⚠️ INSULIN: Blood glucose monitoring required. Hypoglycemia education for caregiver. Keep fast-acting sugar available."}
      {hasPark&&" ⚠️ PARKINSON'S MEDS: Timing is critical. Carbidopa-Levodopa must be taken on schedule. Do not skip or delay doses."}
      {hasPsych&&" ⚠️ PSYCHOTROPIC: Fall risk increased. Monitor for sedation, confusion, orthostatic hypotension."}
      {cogImpaired&&" 🧠 COGNITIVE: Structured routine essential. Redirect, don't argue. Evaluate for wandering risk."}
      {openInc>0&&` 🚨 ${openInc} OPEN INCIDENT${openInc>1?"S":""}: Requires resolution before next visit.`}
      {adlDep>=5&&" Consider increasing visit frequency or transitioning to live-in care model."}
    </p>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// AI SOCIAL AGENT — Activity matching, isolation prevention
// ═══════════════════════════════════════════════════════════════════════
function SocialAgent({cl}){
  const interests=cl.social?.interests||[];
  const mobility=cl.adl?.mobility||"";
  const cognition=cl.adl?.cognition||"";
  const canLeaveHome=!/(Bedbound|Wheelchair dependent|Two-person|Total dependence)/i.test(mobility);
  const canDriveOrRide=!/(Maximum|Total|Bedbound)/i.test(mobility);
  const cogOk=!/(Severe|dementia.*non-verbal)/i.test(cognition);
  const faith=cl.social?.faith||"";

  const suggestions=[];

  // Interest-based suggestions with real Chicago venues
  if(interests.some(i=>/Bridge/i.test(i))) suggestions.push({act:"Bridge Club",where:"Lincoln Park Community Center, 2045 N Lincoln",when:"Tuesdays & Thursdays 1pm",type:"social"});
  if(interests.some(i=>/Classical music/i.test(i))) suggestions.push({act:"CSO Free Concerts",where:"Millennium Park, Jay Pritzker Pavilion",when:"Summer Wednesdays & Fridays 6:30pm",type:"music"});
  if(interests.some(i=>/Jazz/i.test(i))) suggestions.push({act:"Jazz Matinee",where:"Jazz Showcase, 806 S Plymouth Ct",when:"Sundays 4pm matinee",type:"music"});
  if(interests.some(i=>/Cubs/i.test(i))) suggestions.push({act:"Cubs Games (Accessible Seating)",where:"Wrigley Field, 1060 W Addison",when:"Home games April-September",type:"sports"});
  if(interests.some(i=>/old movies|Movies/i.test(i))) suggestions.push({act:"Classic Film Screenings",where:"Music Box Theatre, 3733 N Southport",when:"Various matinees",type:"entertainment"});
  if(interests.some(i=>/Crossword|puzzle/i.test(i))) suggestions.push({act:"Puzzle & Games Club",where:"Chicago Public Library (local branch)",when:"Wednesdays 2pm",type:"social"});
  if(interests.some(i=>/Garden/i.test(i))) suggestions.push({act:"Conservatory Visit",where:"Lincoln Park Conservatory (free)",when:"Open daily 10am-5pm",type:"nature"});
  if(interests.some(i=>/Bird/i.test(i))) suggestions.push({act:"Bird Watching Group",where:"Montrose Point Bird Sanctuary",when:"Spring/Fall migration weekends",type:"nature"});
  if(interests.some(i=>/Book club|Reading/i.test(i))) suggestions.push({act:"Book Discussion Group",where:"Chicago Public Library (local branch)",when:"Monthly, various days",type:"social"});
  if(interests.some(i=>/Bingo/i.test(i))) suggestions.push({act:"Community Bingo Night",where:"Local senior center or church hall",when:"Fridays 6:30pm",type:"social"});
  if(interests.some(i=>/Chair exercise|Yoga|Tai chi|Exercise/i.test(i))) suggestions.push({act:"Senior Fitness Class",where:"Local Park District fieldhouse",when:"Mon/Wed/Fri 10am",type:"exercise"});
  if(interests.some(i=>/Paint|Art|Draw/i.test(i))) suggestions.push({act:"Art Workshop for Seniors",where:"Art Institute of Chicago (free for IL seniors)",when:"Thursdays 1-3pm",type:"arts"});
  if(interests.some(i=>/Museum/i.test(i))) suggestions.push({act:"Museum Free Days",where:"Various Chicago museums",when:"Check schedule (many have free senior days)",type:"culture"});
  if(interests.some(i=>/Walk|Nature walk/i.test(i))&&canLeaveHome) suggestions.push({act:"Guided Nature Walk",where:"Chicago Botanic Garden, Glencoe",when:"Tuesdays & Saturdays 10am",type:"nature"});
  if(interests.some(i=>/Singing|Choir/i.test(i))) suggestions.push({act:"Community Choir",where:"Local church or community center",when:"Weekly rehearsals",type:"music"});
  if(interests.some(i=>/Cook|Bak/i.test(i))) suggestions.push({act:"Cooking Class for Seniors",where:"Local community center kitchen",when:"Monthly demos",type:"social"});
  if(faith&&/Catholic|Christian|Church/i.test(faith)) suggestions.push({act:"Parish Social Group",where:"Local Catholic/Christian church",when:"After Sunday service",type:"spiritual"});
  if(faith&&/Jewish|Temple|Synagogue/i.test(faith)) suggestions.push({act:"Synagogue Social",where:"Local synagogue",when:"Shabbat gatherings",type:"spiritual"});

  // Default suggestions if few interests matched
  if(suggestions.length<3){
    if(canLeaveHome) suggestions.push({act:"Senior Center Day Program",where:"Nearest CJE or Catholic Charities center",when:"Weekdays 9am-3pm",type:"social"});
    suggestions.push({act:"Phone Check-in Program",where:"CJE SeniorLife or Little Brothers",when:"Weekly scheduled calls",type:"social"});
    if(cogOk) suggestions.push({act:"Volunteer Visitor Program",where:"Through RSVP or faith community",when:"Weekly 1-hour visits",type:"social"});
  }

  const isolationRisk=interests.length<3||!canLeaveHome||!cogOk;

  return <div className="ai-card" style={{background:"linear-gradient(135deg,#0a1a0a,#001a0a)"}}>
    <h4><span className="pulse" style={{background:isolationRisk?"#8a7356":"#3c4f3d"}}/>Social Agent — Keeping {cl.name.split(" ")[0]} Active</h4>
    {isolationRisk&& <div style={{padding:"8px 12px",background:"rgba(138,115,86,.15)",marginBottom:10,fontSize:11,fontWeight:600,color:"#ffa94d"}}>⚠️ Social Isolation Risk: {interests.length<3?"Few recorded interests. ":""}{""}
      {!canLeaveHome?"Mobility limits outings. ":""}{!cogOk?"Cognitive status may limit participation. ":""}
      Recommend increasing social engagement frequency.
    </div>}
    <div style={{fontSize:11,opacity:.6,lineHeight:1.7,marginBottom:10}}>
      {interests.length} interests on file. {suggestions.length} activity matches found. {canLeaveHome?"Client can attend outings with transportation.":"Home-based activities recommended due to mobility."} {cogOk?"Cognitive status supports group participation.":"One-on-one activities preferred."}
    </div>
    {suggestions.slice(0,6).map((s,i)=> <div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderTop:"1px solid rgba(255,255,255,.06)"}}>
      <div style={{fontSize:14,width:28,textAlign:"center"}}>{({social:"👥",music:"🎵",sports:"⚾",entertainment:"🎬",nature:"🌿",exercise:"🏃",arts:"🎨",culture:"🏛",spiritual:"⛪"})[s.type]||"📌"}</div>
      <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{s.act}</div><div style={{fontSize:10,opacity:.4}}>{s.where} | {s.when}</div></div>
    </div>)}
  </div>;
}

// ─── ROLES & PERMISSIONS ────────────────────────────────────────────
const ROLES={
  owner:{label:"Owner",level:100,color:"#070707"},
  admin:{label:"Admin",level:80,color:"#3D3E3F"},
  manager:{label:"Manager",level:60,color:"#3c4f3d"},
  caregiver:{label:"Caregiver",level:20,color:"#3f4749"},
  client:{label:"Client",level:10,color:"#8a7356"},
  family:{label:"Family Member",level:5,color:"#4a3f5c"},
};

const PERMS={
  owner:["dash","schedule","clients","care","recon","expenses","gps_map","shift_swap","supplies","billing","payroll","rates","training","recruiting","marketing","events","compliance","audit","portal","family","team","ai_hub","features","notifications","incident_settings","users"],
  admin:["dash","schedule","clients","care","recon","expenses","gps_map","shift_swap","supplies","billing","payroll","rates","training","recruiting","marketing","events","compliance","audit","portal","family","team","features","notifications","incident_settings","users"],
  manager:["dash","schedule","clients","care","recon","expenses","gps_map","shift_swap","supplies","billing","payroll","rates","training","events","compliance","ai_hub","family","team"],
  caregiver:["cg_home","cg_schedule","cg_clients","cg_notes","cg_expenses","cg_training","cg_messages"],
  client:["cl_home","cl_health","cl_goals","cl_schedule","cl_messages","cl_requests","cl_billing","cl_documents","cl_feedback"],
  family:["fm_home","fm_updates","fm_messages","fm_events"],
};

const USERS=[
  {id:"U1",email:"kip@cwinathome.com",pin:"1234",name:"Emmanuel Chepkwony",role:"owner",avatar:"EC",phone:"708-476-0021",title:"Owner / AVP",active:true},
  {id:"U2",email:"admin@cwinathome.com",pin:"4321",name:"Office Admin",role:"admin",avatar:"OA",phone:"708-476-0022",title:"Office Administrator",active:true},
  {id:"U3",email:"erolyn@cwinathome.com",pin:"1111",name:"Erolyn Francis",role:"caregiver",avatar:"EF",phone:"312-555-1001",title:"CNA",caregiverId:"CG1",active:true},
  {id:"U4",email:"faith@cwinathome.com",pin:"2222",name:"Faith Chepkwony",role:"caregiver",avatar:"FC",phone:"312-555-1002",title:"HHA",caregiverId:"CG2",active:true},
  {id:"U5",email:"olena@cwinathome.com",pin:"3333",name:"Olena Krutiak",role:"caregiver",avatar:"OK",phone:"773-555-1003",title:"CNA",caregiverId:"CG3",active:true},
  {id:"U6",email:"tiffany@cwinathome.com",pin:"4444",name:"Tiffany Brown",role:"caregiver",avatar:"TB",phone:"773-555-1004",title:"HHA",caregiverId:"CG4",active:true},
  {id:"U7",email:"becky.sutton@email.com",pin:"5555",name:"Becky Sutton",role:"client",avatar:"BS",phone:"312-555-0101",title:"Client",clientId:"CL1",active:true},
  {id:"U8",email:"linda.frank@email.com",pin:"6666",name:"Linda Frank",role:"client",avatar:"LF",phone:"773-555-0201",title:"Client",clientId:"CL2",active:true},
  {id:"U9",email:"steven.brown@email.com",pin:"7777",name:"Steven Brown",role:"client",avatar:"SB",phone:"773-555-0301",title:"Client",clientId:"CL3",active:true},
  {id:"U10",email:"tom.sutton@email.com",pin:"8888",name:"Tom Sutton",role:"family",avatar:"TS",phone:"312-555-0102",title:"Son of Becky Sutton",clientId:"CL1",active:true},
  {id:"U11",email:"mike.frank@email.com",pin:"9999",name:"Mike Frank",role:"family",avatar:"MF",phone:"773-555-0202",title:"Nephew of Linda Frank",clientId:"CL2",active:true},
  {id:"U12",email:"janet.brown@email.com",pin:"0000",name:"Janet Brown",role:"family",avatar:"JB",phone:"773-555-0302",title:"Wife of Steven Brown",clientId:"CL3",active:true},
];
const uid=()=>Math.random().toString(36).slice(2,9);
const $=n=>"$"+Number(n||0).toFixed(2);
const now=()=>new Date();
const fmtD=d=>new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const fmtT=d=>new Date(d).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
const fmtRel=d=>{const ms=now()-new Date(d);const m=Math.floor(ms/60000);if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`;};
const hrsMin=mins=>{const h=Math.floor(mins/60);const m=mins%60;return `${h}h ${m}m`;};
const MILEAGE_RATE=0.67;
const EXP_CATEGORIES=["Mileage","Groceries","Pharmacy","Supplies","Transportation","Client Meals","Other"];

// ─── GPS SIMULATION ─────────────────────────────────────────────────
const GPS_LOCATIONS={
  CL1:{lat:41.8992,lng:-87.6233,addr:"30 E Elm St, Chicago IL 60611",name:"Becky Sutton"},
  CL2:{lat:41.9517,lng:-87.6547,addr:"3930 N Pine Grove Ave, Chicago IL 60613",name:"Linda Frank"},
  CL3:{lat:41.9714,lng:-87.6536,addr:"4920 N Marine Dr, Chicago IL 60640",name:"Steven Brown"},
};
const simGPS=(base)=>{const j=()=>(Math.random()-.5)*.002;return{lat:base.lat+j(),lng:base.lng+j(),accuracy:5+Math.random()*12,ts:now()};};
const gpsAddr=(lat,lng)=>{const closest=Object.values(GPS_LOCATIONS).reduce((best,loc)=>{const d=Math.abs(loc.lat-lat)+Math.abs(loc.lng-lng);return d<best.d?{d,loc}:best;},{d:Infinity,loc:null});return closest.d<0.01?closest.loc.addr:`${lat.toFixed(4)}°N, ${Math.abs(lng).toFixed(4)}°W`;};
const gpsDist=(a,b)=>{const R=3959;const dLat=(b.lat-a.lat)*Math.PI/180;const dLon=(b.lng-a.lng)*Math.PI/180;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
const today=()=>now().toISOString().split("T")[0];

// ─── SEED: CLIENTS ──────────────────────────────────────────────────
const CLIENTS=[
  {id:"CL1",name:"Becky Sutton",age:78,addr:"30 E Elm St, Chicago IL 60611",phone:"312-555-0101",emergency:"Tom Sutton (son) 312-555-0102",
   dx:["Mild cognitive impairment","Hypertension","Osteoarthritis"],meds:["Lisinopril 10mg","Donepezil 5mg","Acetaminophen PRN"],
   adl:{bathing:"Standby assist — caregiver present for safety, verbal cues only",dressing:"Independent — selects clothes and dresses without assistance",eating:"Independent — feeds self without assistance",toileting:"Independent — uses toilet without assistance, manages clothing",mobility:"Independent with device — uses cane independently",transferring:"Independent — moves in/out of bed, chair, toilet without help",continence:"Continent — full bowel and bladder control",cognition:"Intact — alert, oriented x4 (person, place, time, situation)"},
   social:{interests:["Bridge club","Classical music","Gardening","Reading mystery novels"],faith:"Episcopal",pets:"Cat named Whiskers",birthday:"1947-08-14"},
   preferences:{wakeTime:"7:30 AM",bedTime:"9:00 PM",tea:"Earl Grey with honey",diet:"Low sodium",tvShows:["Jeopardy","PBS NewsHour"]},
   familyPortal:{enabled:true,contacts:[{name:"Tom Sutton",relation:"Son",email:"tom.sutton@email.com",access:["daily_notes","medications","schedule"]},{name:"Sarah Sutton",relation:"Daughter-in-law",email:"sarah.s@email.com",access:["daily_notes","schedule"]}]},
   status:"active",riskLevel:"low",billRate:50,photo:null},
  {id:"CL2",name:"Linda Frank",age:84,addr:"3930 N Pine Grove Ave, Chicago IL 60613",phone:"773-555-0201",emergency:"Mike Frank (nephew) 773-555-0202",
   dx:["CHF (NYHA Class II)","Type 2 Diabetes","Chronic back pain","Depression"],meds:["Metformin 500mg","Furosemide 20mg","Sertraline 50mg","Carvedilol 12.5mg","Gabapentin 300mg"],
   adl:{bathing:"Moderate assist (50%) — needs hands-on help with washing upper or lower body",dressing:"Minimal assist (25%) — needs help with buttons, zippers, or back closures",eating:"Independent with setup — needs meal cut, containers opened, tray positioned",toileting:"Standby assist — needs someone nearby for transfers or balance",mobility:"Fall risk — ambulatory but history of falls, requires precautions",transferring:"Minimal assist (25%) — needs steadying or light support during pivot",continence:"Managed with scheduled toileting — continent when prompted",cognition:"Moderate impairment — needs reminders for daily tasks, supervision recommended"},
   social:{interests:["Watching old movies","Phone calls with friends","Crossword puzzles","Dog care"],faith:"Catholic",pets:"Dog named Buddy",birthday:"1941-11-22"},
   preferences:{wakeTime:"8:00 AM",bedTime:"10:00 PM",tea:"Chamomile",diet:"Diabetic, cardiac",tvShows:["TCM classics","The Price is Right"]},
   familyPortal:{enabled:true,contacts:[{name:"Mike Frank",relation:"Nephew",email:"mike.frank@email.com",access:["daily_notes","medications","incidents","schedule","health_vitals"]}]},
   status:"active",riskLevel:"medium",billRate:35,photo:null},
  {id:"CL3",name:"Steven Brown",age:72,addr:"4920 N Marine Dr, Chicago IL 60640",phone:"773-555-0301",emergency:"Janet Brown (wife) 773-555-0302",
   dx:["Parkinson's disease (Stage 2)","Mild depression","Benign prostatic hyperplasia"],meds:["Carbidopa-Levodopa 25/100","Tamsulosin 0.4mg","Escitalopram 10mg"],
   adl:{bathing:"Minimal assist (25%) — can do most of task, needs help with one body part (e.g. back, feet)",dressing:"Minimal assist due to tremor — fine motor difficulty with fasteners",eating:"Independent with adaptive equipment — uses built-up utensils, plate guard, etc.",toileting:"Independent with equipment — uses raised seat, grab bars, or commode",mobility:"Slow gait, balance issues — ambulatory with gait abnormality",transferring:"Standby assist — caregiver within arm's reach, no contact unless needed",continence:"Occasionally incontinent — accidents less than weekly",cognition:"Mild cognitive impairment (MCI) — diagnosed, memory lapses, judgment intact"},
   social:{interests:["Jazz music","Chess","Watching Cubs games","Reading history books"],faith:"Baptist",pets:"None",birthday:"1953-05-30"},
   preferences:{wakeTime:"7:00 AM",bedTime:"9:30 PM",tea:"Black coffee, 1 sugar",diet:"Regular",tvShows:["Cubs games","60 Minutes","History Channel"]},
   familyPortal:{enabled:true,contacts:[{name:"Janet Brown",relation:"Wife",email:"janet.brown@email.com",access:["daily_notes","medications","incidents","schedule","health_vitals","expenses"]}]},
   status:"active",riskLevel:"medium",billRate:35,photo:null},
];

// ─── SEED: CAREGIVERS ───────────────────────────────────────────────
const CAREGIVERS=[
  {id:"CG1",name:"Erolyn Francis",email:"erolyn@cwinathome.com",phone:"312-555-1001",rate:35,certs:["CNA","CPR/BLS","Alzheimer's Care"],hireDate:"2024-06-15",status:"active",avatar:"EF",photo:null,trainingComplete:8,trainingTotal:12},
  {id:"CG2",name:"Faith Chepkwony",email:"faith@cwinathome.com",phone:"312-555-1002",rate:20,certs:["HHA","CPR/BLS"],hireDate:"2025-01-10",status:"active",avatar:"FC",photo:null,trainingComplete:5,trainingTotal:12},
  {id:"CG3",name:"Olena Krutiak",email:"olena@cwinathome.com",phone:"773-555-1003",rate:20,certs:["CNA","CPR/BLS","Parkinson's Care"],hireDate:"2024-09-01",status:"active",avatar:"OK",photo:null,trainingComplete:10,trainingTotal:12},
  {id:"CG4",name:"Tiffany Brown",email:"tiffany@cwinathome.com",phone:"773-555-1004",rate:20,certs:["HHA","CPR/BLS","First Aid"],hireDate:"2024-11-20",status:"active",avatar:"TB",photo:null,trainingComplete:7,trainingTotal:12},
];

// ─── SEED: TRAINING MODULES ─────────────────────────────────────────
const TRAINING_MODULES=[
  {id:"TM1",title:"Client Rights & Dignity",category:"Compliance",duration:"45 min",difficulty:"Essential",description:"Understanding client rights, privacy (HIPAA), informed consent, and maintaining dignity in daily care.",lessons:["Client Bill of Rights","HIPAA for Home Care","Informed Consent Basics","Cultural Sensitivity","Reporting Rights Violations"],quiz:[{q:"A client's family asks about their medication list. Can you share it?",opts:["Yes, family always has access","Only if the client has given written consent","Only if they seem concerned","Yes, for immediate family"],a:1},{q:"What is the FIRST thing to do when entering a client's home?",opts:["Start cleaning immediately","Greet the client and ask how they're doing","Check medications","Call the office"],a:1}],status:"published"},
  {id:"TM2",title:"Fall Prevention & Safety",category:"Safety",duration:"60 min",difficulty:"Essential",description:"Identifying fall risks, environmental modifications, transfer techniques, and emergency response for falls.",lessons:["Home Hazard Assessment","Safe Transfer Techniques","Assistive Device Use","Post-Fall Protocol","Documentation Requirements"],quiz:[{q:"You find your client on the floor. What do you do FIRST?",opts:["Pick them up immediately","Call 911","Assess for injuries and consciousness","Call the office"],a:2},{q:"Which is NOT a fall risk factor?",opts:["Throw rugs","Adequate lighting","Wet floors","Cluttered walkways"],a:1}],status:"published"},
  {id:"TM3",title:"Medication Reminders & Safety",category:"Clinical",duration:"50 min",difficulty:"Essential",description:"Understanding medication schedules, proper reminders (not administration), recognizing side effects, and documentation.",lessons:["Scope of Practice: Reminders vs Administration","Reading Medication Labels","Common Side Effects to Watch For","When to Call the Nurse/MD","Medication Documentation"],quiz:[{q:"As a home care aide, you can:",opts:["Administer medications","Crush pills and mix in food","Remind clients to take their medications","Change medication dosages"],a:2}],status:"published"},
  {id:"TM4",title:"Infection Control & PPE",category:"Safety",duration:"40 min",difficulty:"Essential",description:"Hand hygiene, PPE use, bloodborne pathogens, cleaning protocols, and COVID-19 precautions.",lessons:["Hand Hygiene (WHO 5 Moments)","PPE Donning & Doffing","Bloodborne Pathogen Standard","Cleaning & Disinfection","Respiratory Illness Protocols"],quiz:[],status:"published"},
  {id:"TM5",title:"Dementia & Alzheimer's Care",category:"Clinical",duration:"90 min",difficulty:"Advanced",description:"Understanding dementia stages, communication techniques, behavioral management, wandering prevention, and caregiver self-care.",lessons:["Types of Dementia","Communication Strategies","Managing Sundowning","Wandering Prevention","Meaningful Activities","Caregiver Burnout Prevention"],quiz:[],status:"published"},
  {id:"TM6",title:"Nutrition & Meal Preparation",category:"Daily Living",duration:"55 min",difficulty:"Core",description:"Therapeutic diets, safe food handling, meal planning for common conditions, and feeding assistance techniques.",lessons:["Diabetic Diet Basics","Cardiac/Low Sodium Diet","Safe Food Handling","Texture-Modified Diets","Hydration Monitoring"],quiz:[],status:"published"},
  {id:"TM7",title:"Personal Care & Hygiene",category:"Daily Living",duration:"60 min",difficulty:"Core",description:"Bathing, grooming, oral care, skin inspection, and maintaining client comfort and dignity.",lessons:["Bathing Techniques & Safety","Skin Inspection & Pressure Sore Prevention","Oral Care","Hair & Nail Care","Incontinence Care"],quiz:[],status:"published"},
  {id:"TM8",title:"Vital Signs & Health Monitoring",category:"Clinical",duration:"45 min",difficulty:"Core",description:"Taking and recording blood pressure, temperature, pulse, respiration, blood glucose, and recognizing abnormal values.",lessons:["Blood Pressure Measurement","Pulse & Respiration","Temperature","Blood Glucose Monitoring","When to Report: Red Flags"],quiz:[],status:"published"},
  {id:"TM9",title:"Emergency Response",category:"Safety",duration:"50 min",difficulty:"Essential",description:"CPR review, choking response, stroke recognition (FAST), diabetic emergencies, and when to call 911.",lessons:["CPR/AED Review","Choking: Heimlich Maneuver","Stroke Recognition (FAST)","Diabetic Emergencies","Seizure Response","Emergency Contact Protocols"],quiz:[],status:"published"},
  {id:"TM10",title:"Documentation & Reporting",category:"Compliance",duration:"40 min",difficulty:"Core",description:"Proper care note documentation, incident reporting, time tracking, and communicating with the care team.",lessons:["Writing Effective Care Notes","Incident Report Procedures","Time Tracking Best Practices","SBAR Communication","Mandatory Reporting Obligations"],quiz:[],status:"published"},
  {id:"TM11",title:"Parkinson's Disease Care",category:"Clinical",duration:"75 min",difficulty:"Advanced",description:"Understanding Parkinson's progression, movement assistance, medication timing, speech and swallowing issues.",lessons:["Parkinson's Disease Overview","Movement & Mobility Assistance","Medication Timing Importance","Speech & Swallowing Support","Emotional & Psychological Support"],quiz:[],status:"published"},
  {id:"TM12",title:"End-of-Life & Palliative Care",category:"Clinical",duration:"60 min",difficulty:"Advanced",description:"Comfort care principles, recognizing end-of-life signs, family support, grief, and self-care for caregivers.",lessons:["Palliative vs Hospice Care","Comfort Measures","Recognizing End-of-Life Signs","Supporting Families","Caregiver Grief & Self-Care"],quiz:[],status:"published"},
  {id:"TM13",title:"Hoyer Lift Operation & Safety",category:"Clinical",duration:"75 min",difficulty:"Essential",description:"Safe operation of Hoyer (hydraulic) patient lifts for transfers between bed, wheelchair, and commode. Covers sling selection, inspection, two-person technique, and emergency procedures.",lessons:[
    {title:"Introduction to Hoyer Lifts",content:"A Hoyer lift is a hydraulic or electric patient lift used to transfer clients who cannot bear weight. It consists of a base with wheels, a mast, a boom arm, and a cradle that attaches to a sling. Hoyer lifts are used when a client: cannot stand or bear weight, is at high risk for falls during transfers, is too heavy for manual transfers, or has a condition (stroke, paralysis, severe arthritis) that limits mobility. NEVER attempt to operate a Hoyer lift alone unless specifically trained and approved for single-person use. Most home care transfers require TWO caregivers."},
    {title:"Sling Types & Selection",content:"Universal/U-Sling: Most common. Supports full body from shoulders to thighs. Use for: bed to wheelchair, wheelchair to commode. Toileting Sling: Has opening at bottom for toileting. Use for: transfers to/from commode or toilet. Hammock Sling: Provides head support. Use for: clients with no head/neck control. Sling Sizing: Measure client's weight and body width. Too small = uncomfortable, risk of skin tears. Too large = client can slip through. Check sling label for weight capacity — NEVER exceed it. Inspect slings before EVERY use for: frayed edges, torn stitching, worn straps, missing clips."},
    {title:"Pre-Transfer Safety Check",content:"Before every transfer: 1) Check lift battery/hydraulic fluid level. 2) Inspect sling for damage. 3) Test lift mechanism — raise and lower boom without client. 4) Lock wheelchair brakes. 5) Clear the path between bed and destination. 6) Explain the procedure to the client. 7) Ensure second caregiver is in position. 8) Check that all sling attachments are secure. 9) Position lift with legs open (wide base) for stability. 10) Confirm client's weight does not exceed lift capacity."},
    {title:"Step-by-Step Transfer Procedure",content:"LIFTING FROM BED: 1) Roll client to side, position sling behind back and under buttocks. 2) Roll client back onto sling, smooth out wrinkles. 3) Spread sling evenly — top edge at shoulder blades, bottom edge at mid-thigh. 4) Wheel lift to bedside, widen base legs. 5) Lower boom, attach sling loops to cradle hooks (shorter loops to shoulder hooks, longer loops to leg hooks). 6) CROSS the leg straps under the client's legs for security. 7) Slowly pump/raise until client is 2 inches above surface. 8) Second caregiver supports client's head and guides. 9) Wheel lift to destination, position client over chair. 10) SLOWLY lower client, removing sling loops from hooks. CRITICAL: Never leave a client suspended. Never walk away during a lift."},
    {title:"Emergency Procedures & Troubleshooting",content:"IF LIFT FAILS MID-TRANSFER: Stay calm. Keep hands on client. If hydraulic, use emergency release valve to slowly lower client to nearest safe surface (bed or floor with padding). Call for help. NEVER attempt to catch a falling client — protect their head. IF SLING TEARS: Immediately lower client to nearest surface. Do not continue the transfer. Report to supervisor. COMMON MISTAKES: Forgetting to lock wheelchair brakes (wheelchair rolls away during transfer). Not crossing leg straps (client can slide out). Lifting too high (unnecessary risk). Rushing (causes injury). Moving lift too fast over thresholds. Document every Hoyer transfer in care notes including: time, number of staff, sling used, any concerns."}
  ],quiz:[{q:"How many caregivers are typically required for a Hoyer lift transfer in home care?",opts:["One","Two","Three","The client can do it alone"],a:1},{q:"What should you do FIRST before placing the sling under the client?",opts:["Attach the sling to the lift","Test the lift mechanism without the client","Call the office","Start pumping the lift"],a:1},{q:"When attaching leg straps to the sling, you should:",opts:["Leave them hanging","Cross them under the client's legs","Tie them in a knot","Skip them if the client seems secure"],a:1},{q:"If the Hoyer lift fails during a transfer, you should:",opts:["Try to catch the client","Use the emergency release to slowly lower to the nearest safe surface","Leave to get help","Pump harder"],a:1}],status:"published"},
  {id:"TM14",title:"Suprapubic Catheter Care",category:"Clinical",duration:"60 min",difficulty:"Advanced",description:"Proper care and maintenance of suprapubic catheters including site cleaning, drainage monitoring, infection prevention, and when to escalate concerns to nursing or the physician.",lessons:[
    {title:"What Is a Suprapubic Catheter?",content:"A suprapubic catheter (SPC) is a urinary drainage tube inserted through the abdominal wall, just above the pubic bone, directly into the bladder. Unlike a standard urethral (Foley) catheter, it does NOT pass through the urethra. SPCs are used for: long-term bladder drainage, urethral obstruction or injury, spinal cord injuries, post-surgical recovery, or client preference over urethral catheter. As a home care aide, you do NOT insert or remove SPCs — that is a nursing/medical procedure. Your role is: daily site care, monitoring drainage, recognizing complications, and reporting changes."},
    {title:"Daily Site Care Procedure",content:"Perform site care once daily or as directed by the care plan. SUPPLIES: Clean gloves, mild soap and warm water (or prescribed cleaning solution), gauze pads, split drain sponge (if ordered), medical tape. PROCEDURE: 1) Wash your hands and apply clean gloves. 2) Gently remove old dressing if present. 3) Inspect the site for redness, swelling, drainage, or odor. 4) Using gauze with warm soapy water, clean around the catheter site in a CIRCULAR motion — starting at the catheter and moving OUTWARD. 5) Never push the catheter in or pull it out. 6) Rinse with clean warm water. 7) Pat dry with clean gauze. 8) Apply split drain sponge around catheter if ordered. 9) Secure catheter to abdomen with tape or stabilization device to prevent pulling. 10) Remove gloves and wash hands. Document: appearance of site, any drainage, client comfort level."},
    {title:"Drainage Bag Management",content:"The catheter connects to a drainage bag that collects urine. KEY RULES: The bag must ALWAYS be below the level of the bladder — never lift it above the client's waist. Empty the bag when it is half to two-thirds full (at least every 8 hours). Wash hands before and after handling the bag. EMPTYING PROCEDURE: 1) Wash hands, apply gloves. 2) Place a clean container under the drainage spout. 3) Open the spout — do not touch the tip. 4) Drain urine into container. 5) Close spout securely. 6) Measure and record output if ordered. 7) Note color, clarity, and any odor. 8) Rinse collection container. 9) Remove gloves, wash hands. Leg bags may be used during the day for mobility — switch to larger bedside bag at night."},
    {title:"Recognizing Complications & When to Report",content:"Report to the nurse or supervisor IMMEDIATELY if you observe: SIGNS OF INFECTION: Redness, warmth, or swelling around the site. Pus or foul-smelling drainage from the site. Fever (temperature above 100.4°F). Cloudy, dark, or foul-smelling urine. Client complaints of pain or burning at the site. CATHETER PROBLEMS: No urine draining for 4+ hours (may be blocked). Urine leaking around the catheter. Catheter appears to have come out or shifted position. Blood in the urine (new or increased amount). Tubing is kinked, cracked, or disconnected. IMPORTANT: Never attempt to reinsert a catheter that has come out. Cover the site with clean gauze and call the nurse immediately."},
    {title:"Client Comfort & Dignity",content:"Catheter care can be embarrassing for clients. Maintain dignity by: always explaining what you are doing before you begin, providing privacy (close doors, use drapes), using a matter-of-fact and professional tone, asking about their comfort throughout the procedure, securing the catheter to prevent painful pulling, encouraging fluid intake (unless restricted) to keep urine flowing, and documenting any concerns the client expresses. Encourage clients to wear loose, comfortable clothing. Monitor skin under tape or stabilization devices for irritation. Catheter care is a skill that builds trust — be patient, gentle, and thorough every time."}
  ],quiz:[{q:"A suprapubic catheter is inserted through the:",opts:["Urethra","Abdominal wall above the pubic bone","Back","Thigh"],a:1},{q:"When cleaning around the catheter site, you should clean in a:",opts:["Back and forth motion","Random pattern","Circular motion starting at the catheter and moving outward","Circular motion starting outward and moving toward the catheter"],a:2},{q:"The drainage bag should ALWAYS be positioned:",opts:["Above the client's waist","At the same level as the bladder","Below the level of the bladder","It doesn't matter"],a:2},{q:"You notice the catheter has come out. You should:",opts:["Try to reinsert it","Cover the site with clean gauze and call the nurse immediately","Ignore it until the next visit","Tape it back in place"],a:1}],status:"published"},
  {id:"TM15",title:"Repositioning Clients in Bed",category:"Clinical",duration:"50 min",difficulty:"Essential",description:"Proper techniques for repositioning bed-bound or limited-mobility clients to prevent pressure injuries, maintain comfort, and ensure safety. Covers turning schedules, log rolling, and using draw sheets.",lessons:[
    {title:"Why Repositioning Matters",content:"Clients who cannot move independently are at high risk for pressure injuries (bed sores/pressure ulcers). Pressure injuries develop when blood flow to skin is cut off by sustained pressure — this can happen in as little as 2 HOURS of lying in the same position. Repositioning prevents: pressure injuries (Stage 1-4, which can be life-threatening), blood clots, pneumonia from fluid pooling in lungs, muscle contractures and joint stiffness, skin breakdown and pain. The standard repositioning schedule is every 2 HOURS. This should be documented in the care plan. Some clients may need more frequent repositioning."},
    {title:"Positioning Options",content:"SUPINE (on back): Pillow under head, small pillow under calves to float heels off bed, arms at sides or on pillows. Avoid hyperextending the neck. LATERAL (side-lying): 30-degree angle (not flat on side). Pillow between knees, pillow supporting top arm, pillow behind back for support. Alternate LEFT and RIGHT sides. PRONE (on stomach): Rarely used in home care. Only if ordered by physician. Pillow under abdomen, head turned to side. SEMI-FOWLER'S (head elevated 30-45°): Used for eating, breathing difficulty, GERD. Pillow under knees to prevent sliding. FOWLER'S (head elevated 60-90°): For eating, severe breathing issues. Support arms with pillows."},
    {title:"Step-by-Step Repositioning Technique",content:"TURNING CLIENT TO SIDE (Two-person preferred): 1) Explain what you are doing. 2) Raise bed to comfortable working height if adjustable. 3) Lower the side rail on the side you are turning the client TOWARD. 4) Stand on the side the client will face. 5) Cross client's far arm over their chest. 6) Cross far leg over near leg. 7) Place one hand on client's far shoulder, other hand on far hip. 8) Gently roll client toward you in one smooth motion. 9) Place pillow behind client's back, between knees, and under top arm. 10) Check that ears, shoulders, hips, and heels are free of pressure. USING A DRAW SHEET (to move up in bed): 1) Two caregivers stand on opposite sides. 2) Roll the draw sheet close to client's body on each side. 3) On count of three, slide client up using your legs (not back). 4) Straighten linens and reposition pillows."},
    {title:"Pressure Point Awareness",content:"When repositioning, pay special attention to these pressure points where skin breaks down fastest: SUPINE: Back of head (occiput), shoulder blades (scapulae), elbows, sacrum/coccyx (tailbone), heels. SIDE-LYING: Ears, shoulders, ribs, hip (greater trochanter), knees (medial), ankles (malleolus). SITTING: Ischial tuberosities (sit bones), shoulder blades, back of thighs. Check these areas during EVERY repositioning for: redness that does not blanch (turn white) when pressed, warmth, swelling, skin breakdown or open areas. Report ANY redness or skin changes to the nurse immediately — early intervention prevents serious wounds."},
    {title:"Documentation & Safety Tips",content:"DOCUMENT EVERY REPOSITION including: time, position placed in, skin assessment findings, client comfort level, and any concerns reported. BODY MECHANICS FOR CAREGIVERS: Stand with feet shoulder-width apart. Bend at knees, not waist. Keep back straight. Use your leg muscles for lifting and pulling. Keep the client close to your body. Never twist — move your feet to turn. Use draw sheets, slide boards, and turning aids when available. NEVER drag a client across sheets (causes friction burns). Ask for help — if a client is too heavy, use a second caregiver or mechanical lift."}
  ],quiz:[{q:"How often should a bed-bound client be repositioned?",opts:["Every 30 minutes","Every 2 hours","Every 4 hours","Once per shift"],a:1},{q:"When turning a client to their side, you should stand:",opts:["On the side they are turning away from","On the side they will face","At the foot of the bed","It doesn't matter"],a:1},{q:"Which is the most common pressure point when lying on the back?",opts:["Knees","Elbows","Sacrum/tailbone","Stomach"],a:2},{q:"When moving a client up in bed with a draw sheet, you should lift with your:",opts:["Back muscles","Arms only","Leg muscles","Shoulders"],a:2}],status:"published"},
  {id:"TM16",title:"Proper Body Alignment & Positioning",category:"Clinical",duration:"45 min",difficulty:"Core",description:"Understanding and maintaining proper body alignment for clients in bed, wheelchairs, and during transfers. Covers anatomical positioning, supportive devices, and contracture prevention.",lessons:[
    {title:"What Is Proper Body Alignment?",content:"Body alignment (also called body mechanics or anatomical position) means positioning the body so that joints, muscles, and bones are in their natural, functional positions. Proper alignment: reduces pain, prevents joint contractures (permanent tightening of muscles/tendons), maintains range of motion, prevents nerve damage from pressure, improves breathing and circulation, and promotes client comfort and dignity. In home care, you maintain alignment during: bed positioning, wheelchair seating, transfers, and activities of daily living. Think of the body as having a 'line of gravity' — an imaginary line from the head through the spine to the feet. All positioning should keep body parts aligned along or symmetrically around this line."},
    {title:"Alignment in Bed (Supine Position)",content:"When the client is lying on their back: HEAD: Centered, not tilted. Small pillow supporting natural curve of neck. SHOULDERS: Even, not rotated. Arms at sides on pillows, palms down or in neutral position. SPINE: Straight, not curved to either side. Small rolled towel under lower back if needed for support. HIPS: Even, not rotated. A trochanter roll (rolled blanket) along the outer thigh can prevent external rotation. KNEES: Slightly flexed (small pillow under knees) to prevent hyperextension. Do NOT place large pillows that keep knees significantly bent — this can cause contractures. FEET: Upright at 90 degrees. Use a footboard or rolled blanket to prevent foot drop (plantar flexion). HEELS: Should float — use heel protectors or a pillow under calves to keep heels off the mattress."},
    {title:"Alignment in Wheelchairs & Seated Positions",content:"HIPS: Should be at 90 degrees, positioned all the way back in the chair. Use cushion for pressure relief. KNEES: At 90 degrees, feet flat on footrests. BACK: Supported against the back of the chair. Use lumbar support cushion if needed. HEAD: Upright and centered. Use headrest for clients with poor head control. ARMS: Resting on armrests or lap tray at a comfortable height. Elbows at approximately 90 degrees. COMMON PROBLEMS: Sliding forward (risk of falling — use non-slip cushion, check posture hourly). Leaning to one side (use lateral supports/pillows). Feet dangling (adjust footrests). Slumping (may need tilt-in-space wheelchair or recline feature). Reposition wheelchair-bound clients for pressure relief every 15-30 minutes — weight shifts (leaning side to side) or brief standing if able."},
    {title:"Contracture Prevention",content:"A contracture is the permanent shortening of muscles, tendons, or ligaments that causes a joint to become fixed in one position. Once formed, contractures are very difficult to reverse. PREVENTION IS KEY: Range of motion exercises (active or passive) as directed in the care plan. Proper positioning with supports and splints. Regular repositioning — never leave a joint in one position for extended periods. Splints and positioning devices: Hand rolls (prevent fist contractures), elbow splints, AFO braces (prevent foot drop), knee immobilizers. HIGH-RISK JOINTS: Fingers/hands (especially after stroke), elbows, shoulders, hips, knees, ankles/feet. Report any stiffness, decreased range of motion, or difficulty straightening a joint to the nurse."},
    {title:"Body Mechanics for Caregivers",content:"YOUR body alignment matters too — proper body mechanics prevent caregiver injuries: STANDING: Feet shoulder-width apart, one foot slightly forward. Knees slightly bent. LIFTING: Bend at knees and hips, NOT at the waist. Keep your back straight. Hold the load close to your body. Tighten your abdominal muscles. Lift with your LEGS, not your back. PUSHING/PULLING: Push rather than pull when possible. Keep arms close to body. Use your body weight to help. TURNING: Move your FEET — never twist at the waist while holding or supporting a client. REACHING: Avoid reaching over or across. Move closer to the task. USE EQUIPMENT: Gait belts, slide sheets, draw sheets, mechanical lifts — these exist to protect both you and the client. If a task feels unsafe, STOP and ask for help. Caregiver injuries are preventable."}
  ],quiz:[{q:"What is a contracture?",opts:["A type of infection","A permanent shortening of muscles/tendons that fixes a joint in one position","A type of pressure injury","A blood clot"],a:1},{q:"To prevent foot drop in a supine client, you should use:",opts:["Extra pillows under the head","A footboard or rolled blanket at the feet","Tight blankets tucked under the mattress","Nothing — it resolves on its own"],a:1},{q:"When lifting a client, you should lift with your:",opts:["Back","Arms","Legs","Shoulders"],a:2},{q:"How often should wheelchair-bound clients do weight shifts?",opts:["Every 2 hours","Once per day","Every 15-30 minutes","Only when they complain of pain"],a:2}],status:"published"},
  {id:"TM17",title:"Blood Pressure Measurement & Monitoring",category:"Clinical",duration:"50 min",difficulty:"Core",description:"Proper technique for measuring blood pressure using manual and automatic cuffs, understanding readings, recognizing abnormal values, and knowing when to report to the nurse or physician.",lessons:[
    {title:"Understanding Blood Pressure",content:"Blood pressure (BP) measures the force of blood pushing against artery walls. It has two numbers: SYSTOLIC (top number): Pressure when the heart BEATS (contracts). This is the higher number. DIASTOLIC (bottom number): Pressure when the heart RESTS between beats. This is the lower number. Written as: systolic/diastolic (e.g., 120/80 mmHg). NORMAL RANGES: Normal: Below 120/80. Elevated: 120-129 / below 80. High (Stage 1): 130-139 / 80-89. High (Stage 2): 140+ / 90+. Crisis (call MD/911): Above 180/120. Low (hypotension): Below 90/60. Many elderly clients take blood pressure medications (antihypertensives). Monitoring helps ensure medications are working and alerts the care team to changes."},
    {title:"Equipment & Preparation",content:"EQUIPMENT: Sphygmomanometer (BP cuff) — manual or automatic, stethoscope (for manual), pen and care note sheet. CUFF SIZING: The cuff bladder should encircle at least 80% of the upper arm. Too small = falsely high reading. Too large = falsely low reading. Sizes: Small, Adult, Large Adult, Thigh. PREPARATION: 1) Client should sit quietly for 5 minutes before measurement. 2) No caffeine, exercise, or smoking for 30 minutes prior. 3) Client should sit with: back supported, feet flat on floor (not crossed), arm supported at heart level on a table or pillow, palm facing up. 4) Remove tight clothing from the arm. 5) Do NOT measure on an arm with: an IV line, a fistula (dialysis access), on the side of a mastectomy, or an injured arm."},
    {title:"Manual Blood Pressure Technique",content:"STEP-BY-STEP: 1) Palpate the brachial artery (inside of elbow crease). 2) Wrap cuff snugly around upper arm, lower edge 1 inch above elbow crease. Arrow on cuff should align over brachial artery. 3) Place stethoscope earpieces in ears, diaphragm (flat side) over brachial artery. 4) Close the valve on the bulb (turn clockwise). 5) Inflate cuff to 180 mmHg (or 30 above expected systolic). 6) Slowly release the valve (2-3 mmHg per second). 7) Listen for the FIRST tapping sound — this is SYSTOLIC. 8) Continue deflating — the point where sounds DISAPPEAR is DIASTOLIC. 9) Fully deflate and remove cuff. 10) Record the reading immediately. If you need to retake, wait 1-2 minutes between measurements. Take 2-3 readings and average them for accuracy."},
    {title:"Using an Automatic (Digital) BP Monitor",content:"Many home care clients have automatic monitors. PROCEDURE: 1) Position client as described in Lesson 2. 2) Apply cuff per manufacturer instructions (usually same arm position as manual). 3) Press START. 4) Remain still and quiet during measurement. 5) Read and record the displayed values. TIPS: Automatic monitors can be less accurate if: the client is moving, has an irregular heartbeat (arrhythmia), or the cuff is wrong size. If the reading seems unusual, retake it. If still unusual, try the other arm. If you have both manual and automatic equipment, verify automatic readings with manual periodically. Document which arm was used, the time, the position (sitting/lying), and the reading."},
    {title:"Recognizing & Reporting Abnormal Values",content:"REPORT IMMEDIATELY (call nurse/MD): Systolic above 180 or below 90. Diastolic above 120 or below 60. Any reading significantly different from the client's baseline. Client complaints of: severe headache, chest pain, shortness of breath, vision changes, dizziness, nosebleed, confusion. DOCUMENT AND MONITOR: Readings consistently above 140/90 — may need medication adjustment. Readings consistently below normal — may indicate over-medication, dehydration, or infection. Orthostatic hypotension: BP drops when client stands (take BP lying, sitting, then standing — report drops of 20+ systolic or 10+ diastolic). COMMON MEDICATIONS that affect BP: Lisinopril, Amlodipine, Metoprolol, Losartan, Hydrochlorothiazide, Furosemide. Know your client's medications and expected BP range from the care plan."}
  ],quiz:[{q:"A blood pressure reading of 120/80 means:",opts:["Systolic is 80, diastolic is 120","Systolic is 120, diastolic is 80","Both numbers are dangerously high","The cuff is broken"],a:1},{q:"Before taking blood pressure, the client should:",opts:["Exercise for 10 minutes","Sit quietly for 5 minutes with feet flat on the floor","Stand up straight","Lie flat on their back"],a:1},{q:"When taking manual blood pressure, the FIRST sound you hear is the:",opts:["Diastolic pressure","Heart rate","Systolic pressure","Background noise"],a:2},{q:"You should call the nurse IMMEDIATELY if the blood pressure reading is:",opts:["125/82","118/76","185/125","130/85"],a:2}],status:"published"},
];

// ─── SEED: TASKS, CHORES, EVENTS ────────────────────────────────────
const seedChores=[
  {id:"CH1",clientId:"CL1",title:"Light housekeeping",frequency:"Every visit",priority:"routine",status:"active",lastDone:today(),assignedTo:"CG1"},
  {id:"CH2",clientId:"CL1",title:"Laundry (wash, dry, fold)",frequency:"2x/week",priority:"routine",status:"active",lastDone:"2026-03-07",assignedTo:"CG1"},
  {id:"CH3",clientId:"CL2",title:"Grocery shopping",frequency:"Weekly",priority:"routine",status:"active",lastDone:"2026-03-04",assignedTo:"CG4"},
  {id:"CH4",clientId:"CL2",title:"Dog care (walk Buddy, feed)",frequency:"Every visit",priority:"high",status:"active",lastDone:today(),assignedTo:"CG4"},
  {id:"CH5",clientId:"CL2",title:"Change bedding",frequency:"Weekly",priority:"routine",status:"active",lastDone:"2026-03-01",assignedTo:"CG4"},
  {id:"CH6",clientId:"CL3",title:"Medication pickup (CVS)",frequency:"Monthly",priority:"high",status:"active",lastDone:"2026-02-25",assignedTo:"CG3"},
  {id:"CH7",clientId:"CL3",title:"Light meal prep",frequency:"Every visit",priority:"routine",status:"active",lastDone:today(),assignedTo:"CG3"},
];

const seedIncidents=[
  {id:"IR1",clientId:"CL2",caregiverId:"CG2",date:"2026-02-28T15:15:00",type:"Emergency Call",severity:"medium",description:"Client reported chest tightness. Vitals: BP 158/92, HR 88. Called MD office, advised to monitor. Resolved after rest and medication.",status:"resolved",followUp:"MD follow-up scheduled 3/5",familyNotified:true},
  {id:"IR2",clientId:"CL2",caregiverId:"CG4",date:"2026-03-03T14:30:00",type:"Near Fall",severity:"low",description:"Client stumbled when transitioning from bed to walker. Caught by caregiver. No injury. Walker brake was not engaged.",status:"resolved",followUp:"Reinforced walker brake check protocol",familyNotified:false},
  {id:"IR3",clientId:"CL3",caregiverId:"CG3",date:"2026-03-06T10:45:00",type:"Medication Issue",severity:"medium",description:"Client reported missing morning dose of Carbidopa-Levodopa. Increased tremor noted. Contacted MD, advised to take dose immediately.",status:"open",followUp:"Pill organizer refill audit needed",familyNotified:true},
];

const seedCareNotes=[
  {id:"CN1",clientId:"CL1",caregiverId:"CG1",date:"2026-03-09T10:00:00",category:"General",text:"Client in good spirits. Prepared Earl Grey tea, assisted with light housekeeping. Watched Jeopardy together. Reminded about medications."},
  {id:"CN2",clientId:"CL2",caregiverId:"CG4",date:"2026-03-08T13:00:00",category:"Health",text:"Helped with shower, changed bedding. BP 142/86. Client reports sleeping better this week. Buddy had his walk. Prepared lunch (low sodium chicken soup)."},
  {id:"CN3",clientId:"CL2",caregiverId:"CG4",date:"2026-03-04T12:00:00",category:"ADL",text:"Breakfast prep, helped set up Medicare online account, business calls, mail sorting, grocery shopping. Client engaged and cooperative."},
  {id:"CN4",clientId:"CL3",caregiverId:"CG3",date:"2026-03-09T09:00:00",category:"Health",text:"Tremor slightly increased today, may be related to missed dose yesterday. Gait steady with cane. Prepared breakfast, assisted with dressing (buttons difficult due to tremor)."},
  {id:"CN5",clientId:"CL2",caregiverId:"CG4",date:"2026-03-01T13:00:00",category:"ADL",text:"Shower assistance, changed bedding, helped install new light fixture, created Social Security online account, light cleaning, rearranged living room chair for better access."},
];

const seedExpenses=[
  {id:"EX1",caregiverId:"CG4",clientId:"CL2",date:"2026-03-04",category:"Groceries",description:"Weekly groceries for Linda (Jewel-Osco)",amount:67.42,receipt:true,status:"approved",gps:"Jewel-Osco, 3531 N Broadway, Chicago"},
  {id:"EX2",caregiverId:"CG3",clientId:"CL3",date:"2026-02-25",category:"Pharmacy",description:"Medication pickup CVS - copay for Carbidopa-Levodopa",amount:15.00,receipt:true,status:"approved",gps:"CVS, 5205 N Broadway, Chicago"},
  {id:"EX3",caregiverId:"CG4",clientId:"CL2",date:"2026-03-01",category:"Supplies",description:"Light fixture + bulbs for bedroom",amount:24.99,receipt:true,status:"pending",gps:"Home Depot, 2570 N Elston Ave, Chicago"},
  {id:"EX4",caregiverId:"CG1",clientId:"CL1",date:"2026-03-06",category:"Transportation",description:"Uber to client (car in shop)",amount:18.50,receipt:true,status:"approved",gps:""},
  {id:"EX5",caregiverId:"CG3",clientId:"CL3",date:"2026-03-05",category:"Mileage",description:"Round trip home to client",amount:12.06,receipt:false,status:"pending",gps:""},
];

const seedEvents=[
  {id:"EV1",clientId:"CL2",title:"Dr. Appointment - Rush Oak Park",date:"2026-03-14T14:00:00",type:"medical",notes:"Annual cardiology follow-up. Need transportation."},
  {id:"EV2",clientId:"CL3",title:"Parkinson's Support Group",date:"2026-03-15T10:00:00",type:"social",notes:"Monthly group at Northwestern. Janet usually drives."},
  {id:"EV3",clientId:"CL1",title:"Bridge Club",date:"2026-03-12T13:00:00",type:"social",notes:"At community center. Client can get there independently."},
  {id:"EV4",clientId:"CL1",title:"Eye Doctor - Routine",date:"2026-03-20T09:30:00",type:"medical",notes:"Dr. Kim, 680 N Lake Shore Dr. Needs ride."},
  {id:"EV5",clientId:"CL3",title:"Cubs Opening Day Watch Party",date:"2026-03-26T13:00:00",type:"social",notes:"AI-suggested: Steven loves Cubs games. Local bar has accessible viewing."},
  {id:"EV6",clientId:"CL2",title:"Classic Movie Night - Music Box Theatre",date:"2026-03-21T19:00:00",type:"social",notes:"AI-suggested: Linda loves old movies. Casablanca screening. Wheelchair accessible."},
];

const seedFamilyMessages=[
  {id:"FM1",clientId:"CL2",from:"Mike Frank",fromType:"family",date:"2026-03-08T09:15:00",text:"How was Linda doing this weekend? She mentioned feeling tired on our call."},
  {id:"FM2",clientId:"CL2",from:"Tiffany Brown",fromType:"caregiver",date:"2026-03-08T14:30:00",text:"Hi Mike, Linda had a good day today. BP was 142/86, which is improved. She did mention being tired but perked up after lunch. We did a full shower and she was in great spirits watching TCM this afternoon."},
  {id:"FM3",clientId:"CL3",from:"Janet Brown",fromType:"family",date:"2026-03-07T11:00:00",text:"Olena, has Steven been taking his Parkinson's meds on time? His tremor seemed worse when I visited yesterday."},
  {id:"FM4",clientId:"CL3",from:"Olena Krutiak",fromType:"caregiver",date:"2026-03-07T16:20:00",text:"Hi Janet, I noticed the same thing. He missed his morning dose on the 6th. I've filed an incident report and we're setting up a better pill organizer system. Dr. Chen has been notified."},
];

// ─── SEED: CLIENT PORTAL ────────────────────────────────────────────
const seedServiceRequests=[
  {id:"SR1",clientId:"CL1",date:"2026-03-07T10:00:00",type:"Schedule Change",description:"I'd like my Wednesday visit moved to Thursday this week. I have a bridge tournament.",status:"approved",response:"Done! Erolyn will visit Thursday 8am-2pm instead.",respondedAt:"2026-03-07T11:30:00"},
  {id:"SR2",clientId:"CL2",date:"2026-03-05T14:00:00",type:"Supply Request",description:"Running low on disposable gloves and hand sanitizer. Also need new bed pads.",status:"completed",response:"Supplies delivered by Tiffany on 3/6. Receipt submitted.",respondedAt:"2026-03-06T09:00:00"},
  {id:"SR3",clientId:"CL3",date:"2026-03-08T09:00:00",type:"Caregiver Feedback",description:"Olena has been wonderful. Very patient with my tremor and always on time. Please tell her I appreciate her.",status:"acknowledged",response:"Thank you, Steven! We've shared your kind words with Olena. She was very touched.",respondedAt:"2026-03-08T16:00:00"},
  {id:"SR4",clientId:"CL2",date:"2026-03-09T08:00:00",type:"Schedule Change",description:"Can we add an extra visit on Saturday for help with spring cleaning?",status:"pending",response:"",respondedAt:""},
  {id:"SR5",clientId:"CL1",date:"2026-03-04T11:00:00",type:"Concern",description:"My caregiver left 15 minutes early last Tuesday. Not a huge deal but wanted to mention it.",status:"resolved",response:"Thank you for letting us know, Becky. We've reviewed the time records and spoken with Erolyn. This has been addressed.",respondedAt:"2026-03-04T15:00:00"},
];

// ═══════════════════════════════════════════════════════════════════════
// FEATURE FLAGS — Per-client and per-caregiver feature toggles
// ═══════════════════════════════════════════════════════════════════════
const FEATURES=[
  // AI Features
  {id:"ai_care_notes",label:"AI Care Note Assistant",desc:"Caregiver writes brief note → AI expands to full clinical documentation",icon:"📝",cat:"AI",appliesTo:["caregiver","client"],default:true},
  {id:"ai_incident_triage",label:"AI Incident Triage",desc:"AI analyzes incidents and suggests severity, actions, and notifications",icon:"🚨",cat:"AI",appliesTo:["caregiver","client"],default:true},
  {id:"ai_schedule_opt",label:"AI Schedule Optimizer",desc:"AI suggests optimal schedules based on certs, availability, geography",icon:"📅",cat:"AI",appliesTo:["caregiver","client"],default:false},
  {id:"ai_family_summary",label:"AI Family Communications",desc:"Auto-generated weekly summaries personalized for each family member",icon:"💬",cat:"AI",appliesTo:["client"],default:true},
  {id:"ai_onboarding",label:"AI Onboarding Coach",desc:"AI tutor for new caregivers: HIPAA, dementia care, CWIN procedures",icon:"🎓",cat:"AI",appliesTo:["caregiver"],default:true},
  {id:"ai_compliance",label:"AI Compliance Watcher",desc:"Predicts expirations, drafts renewal reminders, scans for gaps",icon:"🛡️",cat:"AI",appliesTo:["caregiver"],default:true},
  // Operations
  {id:"gps_live_map",label:"Real-Time GPS Map",desc:"Live caregiver location during shifts (requires phone GPS)",icon:"📍",cat:"Operations",appliesTo:["caregiver","client"],default:false},
  {id:"shift_swapping",label:"Smart Shift Swapping",desc:"Caregivers request swaps; AI finds qualified replacements",icon:"🔄",cat:"Operations",appliesTo:["caregiver"],default:true},
  {id:"auto_recon",label:"Auto-Reconciliation",desc:"Auto-match scheduled vs actual hours, flag discrepancies",icon:"🔍",cat:"Operations",appliesTo:["caregiver","client"],default:true},
  {id:"visit_verification",label:"Visit Verification (Selfie+GPS)",desc:"Selfie + GPS check at clock-in/out for proof of presence",icon:"📸",cat:"Operations",appliesTo:["caregiver","client"],default:false},
  {id:"supply_tracking",label:"Supply Tracking",desc:"Track inventory (gloves, wipes, meds) with auto-reorder alerts",icon:"📦",cat:"Operations",appliesTo:["client"],default:false},
  // Compliance & Trust
  {id:"hipaa_chat",label:"HIPAA-Compliant Chat",desc:"End-to-end encrypted messaging between family/caregivers/admin",icon:"🔐",cat:"Compliance",appliesTo:["caregiver","client"],default:true},
  {id:"audit_log",label:"Detailed Audit Log",desc:"Every action logged for compliance and dispute resolution",icon:"📜",cat:"Compliance",appliesTo:["caregiver","client"],default:true},
  {id:"e_signature",label:"Document E-Signature",desc:"Sign care plans, agreements, consents in-app",icon:"✍️",cat:"Compliance",appliesTo:["client"],default:false},
  // Mobile & Accessibility
  {id:"voice_commands",label:"Voice Commands",desc:'"Hey CWIN, log a care note for Becky"',icon:"🎤",cat:"Mobile",appliesTo:["caregiver","client"],default:false},
  {id:"multi_language",label:"Multi-Language Support",desc:"Spanish, Polish for clients/families (Chicago languages)",icon:"🌍",cat:"Mobile",appliesTo:["client"],default:false},
  {id:"large_fonts",label:"Large Fonts / Accessibility Mode",desc:"One-tap accessibility for elderly clients",icon:"🔍",cat:"Mobile",appliesTo:["client"],default:true},
];

const seedSurveys=[
  {id:"SV1",clientId:"CL1",date:"2026-03-01",ratings:{overall:5,punctuality:5,communication:5,skills:4,respect:5,reliability:5},comments:"Erolyn is absolutely wonderful. She knows exactly how I like my tea and is always cheerful. I feel very comfortable with her.",caregiver:"CG1"},
  {id:"SV2",clientId:"CL2",date:"2026-03-01",ratings:{overall:4,punctuality:4,communication:5,skills:5,respect:5,reliability:4},comments:"Tiffany is great with Buddy and very thorough with my medications. Sometimes she runs a bit late but always calls ahead.",caregiver:"CG4"},
  {id:"SV3",clientId:"CL3",date:"2026-03-01",ratings:{overall:5,punctuality:5,communication:5,skills:5,respect:5,reliability:5},comments:"Olena understands Parkinson's very well. She never rushes me and adapts to my good and bad days. Exceptional care.",caregiver:"CG3"},
  {id:"SV4",clientId:"CL1",date:"2026-02-01",ratings:{overall:5,punctuality:5,communication:4,skills:5,respect:5,reliability:5},comments:"Very satisfied with care. Would appreciate a bit more advance notice if schedule changes.",caregiver:"CG1"},
];

const seedCareGoals=[
  {id:"CG01",clientId:"CL1",title:"Maintain independent dressing",category:"ADL",target:"Continue independent dressing 5+ days/week",progress:90,status:"on-track",notes:"Becky dresses independently every day. Occasional help with back zippers."},
  {id:"CG02",clientId:"CL1",title:"Social engagement",category:"Wellness",target:"Attend 2+ social activities per month",progress:100,status:"achieved",notes:"Attending bridge club weekly and gardening group monthly."},
  {id:"CG03",clientId:"CL2",title:"Fall prevention",category:"Safety",target:"Zero falls for 90 days",progress:60,status:"at-risk",notes:"One near-fall on 3/3. Walker brake protocol reinforced. 45 days since last incident."},
  {id:"CG04",clientId:"CL2",title:"Blood pressure management",category:"Health",target:"BP consistently below 150/90",progress:75,status:"on-track",notes:"Trending downward. Last reading 142/86. Diet compliance improving."},
  {id:"CG05",clientId:"CL3",title:"Medication adherence",category:"Health",target:"100% on-time medication for 30 days",progress:40,status:"at-risk",notes:"Missed dose on 3/6. Pill organizer system being set up."},
  {id:"CG06",clientId:"CL3",title:"Physical activity",category:"Wellness",target:"15 min daily movement/exercise",progress:80,status:"on-track",notes:"Doing chair exercises 5x/week. Walks to mailbox daily."},
];

const seedVitals=[
  {id:"V1",clientId:"CL2",date:"2026-03-09",bp:"138/84",hr:76,temp:"98.4",glucose:142,weight:168,notes:"Good day, client reports feeling well",recordedBy:"CG4"},
  {id:"V2",clientId:"CL2",date:"2026-03-08",bp:"142/86",hr:78,temp:"98.2",glucose:156,weight:168,notes:"Slightly elevated glucose after birthday cake yesterday",recordedBy:"CG4"},
  {id:"V3",clientId:"CL2",date:"2026-03-04",bp:"148/88",hr:82,temp:"98.6",glucose:138,weight:169,notes:"",recordedBy:"CG4"},
  {id:"V4",clientId:"CL2",date:"2026-03-01",bp:"145/87",hr:80,temp:"98.4",glucose:145,weight:169,notes:"",recordedBy:"CG4"},
  {id:"V5",clientId:"CL3",date:"2026-03-09",bp:"128/78",hr:68,temp:"98.2",glucose:null,weight:182,notes:"Tremor slightly increased, may be related to missed dose",recordedBy:"CG3"},
  {id:"V6",clientId:"CL3",date:"2026-03-06",bp:"124/76",hr:66,temp:"98.4",glucose:null,weight:182,notes:"Good day, steady gait",recordedBy:"CG3"},
  {id:"V7",clientId:"CL1",date:"2026-03-09",bp:"132/80",hr:72,temp:"98.6",glucose:null,weight:145,notes:"Excellent spirits",recordedBy:"CG1"},
];

const seedDocuments=[
  {id:"D1",clientId:"CL1",name:"Care Plan - Q1 2026",type:"care_plan",date:"2026-01-15",size:"2.4 MB"},
  {id:"D2",clientId:"CL1",name:"Signed Service Agreement",type:"agreement",date:"2024-06-01",size:"1.1 MB"},
  {id:"D3",clientId:"CL2",name:"Care Plan - Q1 2026",type:"care_plan",date:"2026-01-15",size:"3.1 MB"},
  {id:"D4",clientId:"CL2",name:"Cardiology Report - Feb 2026",type:"medical",date:"2026-02-20",size:"890 KB"},
  {id:"D5",clientId:"CL2",name:"Signed Service Agreement",type:"agreement",date:"2024-09-01",size:"1.1 MB"},
  {id:"D6",clientId:"CL3",name:"Care Plan - Q1 2026",type:"care_plan",date:"2026-01-15",size:"2.8 MB"},
  {id:"D7",clientId:"CL3",name:"Parkinson's Treatment Summary",type:"medical",date:"2026-01-10",size:"1.5 MB"},
  {id:"D8",clientId:"CL3",name:"Signed Service Agreement",type:"agreement",date:"2024-09-01",size:"1.1 MB"},
];

// ─── SEED: RECRUITING ───────────────────────────────────────────────
const seedCGApplicants=[
  {id:"AP1",name:"Diana Rodriguez",email:"diana.r@email.com",phone:"312-555-2001",certs:["CNA","CPR/BLS"],experience:"3 years home care, 2 years assisted living",availability:"Full-time",preferredAreas:["North Side","Lincoln Park"],status:"interview",appliedDate:"2026-03-01",notes:"Strong references, bilingual English/Spanish",bgCheck:"pending",source:"Indeed"},
  {id:"AP2",name:"Marcus Johnson",email:"marcus.j@email.com",phone:"773-555-2002",certs:["HHA"],experience:"1 year home care",availability:"Part-time weekends",preferredAreas:["South Side","Hyde Park"],status:"screening",appliedDate:"2026-03-05",notes:"Currently in CNA program, graduates May 2026",bgCheck:"not_started",source:"Referral (Tiffany Brown)"},
  {id:"AP3",name:"Aisha Okafor",email:"aisha.o@email.com",phone:"312-555-2003",certs:["CNA","CPR/BLS","Dementia Care","Wound Care"],experience:"7 years home care, hospice experience",availability:"Full-time",preferredAreas:["Lakeview","Gold Coast","Lincoln Park"],status:"offer",appliedDate:"2026-02-20",notes:"Exceptional candidate. Hospice and wound care experience rare.",bgCheck:"passed",source:"LinkedIn"},
  {id:"AP4",name:"Chen Wei",email:"chen.w@email.com",phone:"773-555-2004",certs:["HHA","CPR/BLS"],experience:"2 years, agency experience",availability:"Full-time",preferredAreas:["Uptown","Edgewater"],status:"new",appliedDate:"2026-03-08",notes:"Mandarin speaker, good reviews from previous agency",bgCheck:"not_started",source:"CWINathome.com"},
];

const seedClientLeads=[
  {id:"LD1",name:"Dorothy Martinez",age:81,phone:"312-555-3001",referralSource:"Rush Hospital Discharge",needs:"Post-hip replacement, 4-6 weeks ADL assistance",hoursNeeded:"6 hrs/day, 5 days/week",status:"assessment",assessmentDate:"2026-03-12",notes:"Daughter Maria is POA. Insurance: Medicare + BCBS supplement.",urgency:"high"},
  {id:"LD2",name:"Harold Kim",age:76,phone:"773-555-3002",referralSource:"Dr. Susan Park (Neurologist)",needs:"Early-stage Alzheimer's, companionship and safety monitoring",hoursNeeded:"4 hrs/day, 3 days/week",status:"inquiry",assessmentDate:"",notes:"Wife works full-time, needs daytime coverage. Lives in Skokie.",urgency:"medium"},
  {id:"LD3",name:"Patricia O'Brien",age:88,phone:"312-555-3003",referralSource:"Family self-referral (website)",needs:"Full personal care, meals, housekeeping. Lives alone.",hoursNeeded:"8 hrs/day, 7 days/week",status:"proposal",assessmentDate:"2026-03-08",notes:"Assessment complete. Proposing $45/hr. Son James reviewing contract.",urgency:"high"},
  {id:"LD4",name:"George Washington III",age:70,phone:"773-555-3004",referralSource:"Veterans Affairs",needs:"Parkinson's care, medication management, mobility assistance",hoursNeeded:"4 hrs/day, 5 days/week",status:"new",assessmentDate:"",notes:"VA may cover partial cost. Needs Parkinson's-trained caregiver.",urgency:"medium"},
];

// ─── SEED: COMPLIANCE ───────────────────────────────────────────────
const seedComplianceItems=[
  {id:"CO1",type:"Background Check",entity:"Erolyn Francis",entityType:"caregiver",dueDate:"2026-06-15",status:"current",notes:"Annual renewal due June"},
  {id:"CO2",type:"CPR/BLS Certification",entity:"Faith Chepkwony",entityType:"caregiver",dueDate:"2026-04-10",status:"expiring_soon",notes:"30 days until expiration"},
  {id:"CO3",type:"TB Test",entity:"Olena Krutiak",entityType:"caregiver",dueDate:"2026-03-20",status:"overdue",notes:"Was due March 20, needs scheduling ASAP"},
  {id:"CO4",type:"Service Agreement",entity:"Becky Sutton",entityType:"client",dueDate:"2026-06-01",status:"current",notes:"Annual renewal"},
  {id:"CO5",type:"Care Plan Review",entity:"Linda Frank",entityType:"client",dueDate:"2026-03-15",status:"expiring_soon",notes:"Quarterly review due, needs MD signature"},
  {id:"CO6",type:"HIPAA Training",entity:"All Staff",entityType:"company",dueDate:"2026-04-01",status:"expiring_soon",notes:"Annual company-wide HIPAA refresher"},
  {id:"CO7",type:"W-9 on File",entity:"Tiffany Brown",entityType:"caregiver",dueDate:"2026-12-31",status:"current",notes:"Updated January 2026"},
  {id:"CO8",type:"Liability Insurance",entity:"CWIN At Home LLC",entityType:"company",dueDate:"2026-09-01",status:"current",notes:"Policy #HC-2024-8891"},
  {id:"CO9",type:"Workers Comp",entity:"CWIN At Home LLC",entityType:"company",dueDate:"2026-09-01",status:"current",notes:"Policy #WC-2024-3344"},
  {id:"CO10",type:"Background Check",entity:"Tiffany Brown",entityType:"caregiver",dueDate:"2026-05-20",status:"expiring_soon",notes:"Annual renewal due May"},
];

// ─── SEED: RECONCILIATION ───────────────────────────────────────────
const seedReconEntries=[
  {id:"RC1",caregiverId:"CG1",clientId:"CL1",date:"2026-03-09",scheduled:{start:"09:00",end:"15:00",hours:6},actual:{clockIn:"09:43",clockOut:"15:13",hours:5.5},gpsIn:"E Elm St, 30, Chicago",gpsOut:"E Elm St, 18, Chicago",gpsMatch:true,variance:-0.5,flags:["LATE_ARRIVAL"],billRate:50,payRate:35,billedAmount:275,paidAmount:192.5,margin:82.5,status:"review"},
  {id:"RC2",caregiverId:"CG1",clientId:"CL1",date:"2026-03-06",scheduled:{start:"09:00",end:"16:00",hours:7},actual:{clockIn:"10:03",clockOut:"16:04",hours:6.02},gpsIn:"E Elm St, 30, Chicago",gpsOut:"E Elm St, 22, Chicago",gpsMatch:true,variance:-0.98,flags:["LATE_ARRIVAL","SHORT_SHIFT"],billRate:50,payRate:35,billedAmount:301,paidAmount:210.58,margin:90.42,status:"flagged"},
  {id:"RC3",caregiverId:"CG3",clientId:"CL3",date:"2026-03-09",scheduled:{start:"08:00",end:"13:00",hours:5},actual:{clockIn:"08:55",clockOut:"13:07",hours:4.2},gpsIn:"N Marine Dr, 4920, Chicago",gpsOut:"N Marine Dr, 4920, Chicago",gpsMatch:true,variance:-0.8,flags:[],billRate:35,payRate:20,billedAmount:147,paidAmount:84,margin:63,status:"approved"},
  {id:"RC4",caregiverId:"CG4",clientId:"CL2",date:"2026-03-08",scheduled:{start:"12:00",end:"20:00",hours:8},actual:{clockIn:"12:17",clockOut:"19:29",hours:7.2},gpsIn:"Linda Frank",gpsOut:"N Lake Shore Dr, 3778, Chicago",gpsMatch:false,variance:-0.8,flags:["GPS_MISMATCH_OUT","ADMIN_EDITED"],billRate:35,payRate:20,billedAmount:252,paidAmount:144,margin:108,status:"review"},
  {id:"RC5",caregiverId:"CG2",clientId:"CL2",date:"2026-02-28",scheduled:{start:"15:00",end:"17:00",hours:2},actual:{clockIn:"15:15",clockOut:"17:15",hours:2},gpsIn:"Linda Frank",gpsOut:"Updated by admin",gpsMatch:false,variance:0,flags:["EMERGENCY","ADMIN_EDITED"],billRate:35,payRate:20,billedAmount:70,paidAmount:0,margin:70,status:"approved"},
];

// ─── SEED: MARKETING ────────────────────────────────────────────────
const seedCampaigns=[
  {id:"MK1",name:"Spring Home Care Awareness",channel:"Facebook/Instagram",status:"active",startDate:"2026-03-01",endDate:"2026-03-31",budget:500,spent:235,leads:12,conversions:2,cpl:19.58,notes:"Targeting 60+ adults with aging parents in Chicago metro"},
  {id:"MK2",name:"Hospital Discharge Partnerships",channel:"Direct Outreach",status:"active",startDate:"2026-01-15",endDate:"2026-06-30",budget:0,spent:0,leads:8,conversions:3,cpl:0,notes:"Rush, Northwestern, Advocate partnerships"},
  {id:"MK3",name:"Google My Business Optimization",channel:"SEO/Local",status:"active",startDate:"2026-01-01",endDate:"2026-12-31",budget:150,spent:150,leads:6,conversions:1,cpl:25,notes:"Monthly GMB posts, review responses, local SEO"},
  {id:"MK4",name:"Caregiver Recruitment - Indeed",channel:"Indeed/LinkedIn",status:"active",startDate:"2026-02-15",endDate:"2026-04-15",budget:300,spent:180,leads:15,conversions:3,cpl:12,notes:"Sponsored job posts for CNA/HHA positions"},
  {id:"MK5",name:"Referral Bonus Program",channel:"Word of Mouth",status:"active",startDate:"2026-01-01",endDate:"2026-12-31",budget:2000,spent:500,leads:4,conversions:2,cpl:125,notes:"$250 bonus for client referral, $150 for caregiver referral"},
];

// ─── DATE HELPERS ───────────────────────────────────────────────────
const toISO=d=>d.toISOString().split("T")[0];
const fromISO=s=>{const[y,m,d]=s.split("-");return new Date(+y,+m-1,+d);};
const addDays=(d,n)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r;};
const getMonday=d=>{const r=new Date(d);const day=r.getDay();r.setDate(r.getDate()-(day===0?6:day-1));return r;};
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const fmtShort=d=>d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
const timeToMin=t=>{const[h,m]=t.split(":").map(Number);return h*60+(m||0);};

// ─── TASK PRESETS ───────────────────────────────────────────────────
const TASK_PRESETS={
  morning:["Morning routine assist","Prepare breakfast","Medication reminder","Light housekeeping","Companionship"],
  afternoon:["Prepare lunch","Medication reminder","Laundry","Errands/shopping","Companionship"],
  fullday:["Morning/afternoon routine","Meals (breakfast, lunch, dinner)","Medication management","Housekeeping","Laundry","Companionship & activities"],
  evening:["Prepare dinner","Evening medication","Bedtime routine","Light cleanup"],
};

// ─── SEED: SCHEDULES ────────────────────────────────────────────────
const MON=toISO(getMonday(now()));
const seedSchedules=[
  {id:"SC1",caregiverId:"CG1",clientId:"CL1",date:toISO(addDays(getMonday(now()),0)),startTime:"08:00",endTime:"14:00",tasks:["Morning routine assist","Prepare lunch","Light housekeeping","Medication reminder","Companionship"],notes:"Tea: Earl Grey with honey at 10am",status:"published",color:"#3c4f3d"},
  {id:"SC2",caregiverId:"CG4",clientId:"CL2",date:toISO(addDays(getMonday(now()),0)),startTime:"11:00",endTime:"19:00",tasks:["Full day care","Meals","Dog care (Buddy)","Laundry","Medicare account setup"],notes:"Walker, fall precautions",status:"published",color:"#3f4749"},
  {id:"SC3",caregiverId:"CG3",clientId:"CL3",date:toISO(addDays(getMonday(now()),0)),startTime:"08:00",endTime:"13:00",tasks:["Morning routine","Breakfast","Medication (Carbidopa-Levodopa timing critical)","Chair exercises","Companionship"],notes:"Adaptive utensils in top drawer",status:"published",color:"#8a7356"},
  {id:"SC4",caregiverId:"CG1",clientId:"CL1",date:toISO(addDays(getMonday(now()),1)),startTime:"08:00",endTime:"14:00",tasks:["Morning routine assist","Prepare lunch","Housekeeping","Medication reminder"],notes:"",status:"published",color:"#3c4f3d"},
  {id:"SC5",caregiverId:"CG3",clientId:"CL3",date:toISO(addDays(getMonday(now()),1)),startTime:"12:00",endTime:"17:00",tasks:["Lunch prep","Medication","CVS medication pickup","Companionship"],notes:"Pick up Carbidopa-Levodopa refill",status:"published",color:"#8a7356"},
  {id:"SC6",caregiverId:"CG4",clientId:"CL2",date:toISO(addDays(getMonday(now()),1)),startTime:"11:00",endTime:"16:00",tasks:["Meals","Grocery shopping","Light cleaning","Dog care"],notes:"Jewel-Osco list on fridge",status:"published",color:"#3f4749"},
  {id:"SC7",caregiverId:"CG2",clientId:"CL2",date:toISO(addDays(getMonday(now()),2)),startTime:"10:00",endTime:"19:00",tasks:["Full day care","Shower assist","Meals","Bedding change","Dog care"],notes:"Emergency contact: Mike Frank",status:"published",color:"#4a3f5c"},
  {id:"SC8",caregiverId:"CG3",clientId:"CL3",date:toISO(addDays(getMonday(now()),2)),startTime:"08:00",endTime:"13:00",tasks:["Morning routine","Breakfast","Medication","Chair exercises"],notes:"",status:"published",color:"#8a7356"},
  {id:"SC9",caregiverId:"CG1",clientId:"CL1",date:toISO(addDays(getMonday(now()),3)),startTime:"08:00",endTime:"14:00",tasks:["Morning routine","Lunch","Housekeeping","Medication","Bridge club transport"],notes:"Bridge at 1pm, community center",status:"published",color:"#3c4f3d"},
  {id:"SC10",caregiverId:"CG4",clientId:"CL2",date:toISO(addDays(getMonday(now()),3)),startTime:"11:00",endTime:"16:30",tasks:["Meals","Business calls assist","Mail sorting","Grocery run"],notes:"",status:"published",color:"#3f4749"},
  {id:"SC11",caregiverId:"CG3",clientId:"CL3",date:toISO(addDays(getMonday(now()),4)),startTime:"08:00",endTime:"13:00",tasks:["Morning routine","Breakfast","Medication","Companionship"],notes:"",status:"published",color:"#8a7356"},
  {id:"SC12",caregiverId:"CG1",clientId:"CL1",date:toISO(addDays(getMonday(now()),4)),startTime:"07:00",endTime:"16:00",tasks:["Full day","Meals","Housekeeping","Eye doctor transport","Medication"],notes:"Eye Dr. Kim at 9:30am, 680 N Lake Shore",status:"published",color:"#3c4f3d"},
  // Next week drafts
  {id:"SC13",caregiverId:"CG1",clientId:"CL1",date:toISO(addDays(getMonday(now()),7)),startTime:"08:00",endTime:"14:00",tasks:["Morning routine","Lunch","Housekeeping","Medication"],notes:"",status:"draft",color:"#3c4f3d"},
  {id:"SC14",caregiverId:"CG3",clientId:"CL3",date:toISO(addDays(getMonday(now()),7)),startTime:"08:00",endTime:"13:00",tasks:["Morning routine","Breakfast","Medication","Exercises"],notes:"",status:"draft",color:"#8a7356"},
  {id:"SC15",caregiverId:"CG4",clientId:"CL2",date:toISO(addDays(getMonday(now()),7)),startTime:"11:00",endTime:"19:00",tasks:["Full day care","Meals","Dog care","Laundry"],notes:"",status:"draft",color:"#3f4749"},
];

// ─── ASSIGNMENTS (CG ↔ Client) ──────────────────────────────────────
const seedAssignments=[
  {caregiverId:"CG1",clientId:"CL1",status:"active",startDate:"2024-07-01"},
  {caregiverId:"CG2",clientId:"CL2",status:"active",startDate:"2025-01-15"},
  {caregiverId:"CG3",clientId:"CL3",status:"active",startDate:"2024-09-15"},
  {caregiverId:"CG4",clientId:"CL2",status:"active",startDate:"2024-12-01"},
  {caregiverId:"CG4",clientId:"CL3",status:"active",startDate:"2025-02-01"},
];

// ─── BILLING & PAYROLL SEED DATA ────────────────────────────────────
const seedRateCards=[
  {clientId:"CL1",billRate:50,otRate:75,otThreshold:40,notes:"Premium rate — complex care needs"},
  {clientId:"CL2",billRate:35,otRate:52.5,otThreshold:40,notes:"Standard rate"},
  {clientId:"CL3",billRate:35,otRate:52.5,otThreshold:40,notes:"Standard rate — Parkinson's specialty"},
];
const seedPayCards=[
  {caregiverId:"CG1",payRate:35,otRate:52.5,otThreshold:40,type:"employee",w4:true,notes:"CNA — Senior rate"},
  {caregiverId:"CG2",payRate:20,otRate:30,otThreshold:40,type:"employee",w4:true,notes:"HHA"},
  {caregiverId:"CG3",payRate:20,otRate:30,otThreshold:40,type:"contractor",w4:false,notes:"CNA — 1099 contractor"},
  {caregiverId:"CG4",payRate:20,otRate:30,otThreshold:40,type:"employee",w4:true,notes:"HHA"},
];
const seedBillingPeriods=[
  {id:"BP1",label:"Mar 1-15, 2026",start:"2026-03-01",end:"2026-03-15",weekNumbers:[9,10],payDate:"2026-03-22",status:"open"},
  {id:"BP2",label:"Feb 15-28, 2026",start:"2026-02-15",end:"2026-02-28",weekNumbers:[7,8],payDate:"2026-03-07",status:"closed"},
];
const seedInvoices=[
  {id:"INV-2026-001",clientId:"CL1",periodId:"BP2",date:"2026-03-01",dueDate:"2026-03-15",status:"sent",
    lines:[
      {date:"2026-02-25",caregiver:"Erolyn Francis",hours:6,rate:50,total:300,notes:"Morning routine + lunch"},
      {date:"2026-02-27",caregiver:"Erolyn Francis",hours:7,rate:50,total:350,notes:"Full day + errands"},
    ],subtotal:650,expenses:67.42,tax:0,total:717.42},
  {id:"INV-2026-002",clientId:"CL2",periodId:"BP2",date:"2026-03-01",dueDate:"2026-03-15",status:"paid",
    lines:[
      {date:"2026-02-25",caregiver:"Tiffany Brown",hours:8,rate:35,total:280,notes:"Full day care"},
      {date:"2026-02-28",caregiver:"Faith Chepkwony",hours:2,rate:35,total:70,notes:"Emergency visit"},
    ],subtotal:350,expenses:0,tax:0,total:350},
];
const seedPaySlips=[
  {id:"PS-2026-001",caregiverId:"CG1",periodId:"BP2",date:"2026-03-01",status:"paid",
    lines:[{clientName:"Becky Sutton",hours:13,rate:35,total:455}],
    regHours:13,otHours:0,regPay:455,otPay:0,expenses:0,mileage:0,grossPay:455,type:"employee"},
  {id:"PS-2026-002",caregiverId:"CG4",periodId:"BP2",date:"2026-03-01",status:"paid",
    lines:[{clientName:"Linda Frank",hours:8,rate:20,total:160}],
    regHours:8,otHours:0,regPay:160,otPay:0,expenses:67.42,mileage:12.5,grossPay:235.80,type:"employee"},
];

// ─── INCIDENT AI RESPONSE TEMPLATES (Admin-editable) ────────────────
const DEFAULT_INCIDENT_PROMPTS={
  "Fall":{immediate:"1. Do NOT move the client. 2. Assess consciousness and ask where it hurts. 3. Check for visible injuries (bleeding, swelling, deformity). 4. If head hit or loss of consciousness, call 911. 5. If no apparent injury, assist to comfortable position using proper body mechanics. 6. Apply ice to any bumps/bruises.",report:"Document exact location, time, what client was doing, surface type, footwear, lighting, and witnesses. Note vitals post-fall.",notify:"Notify office immediately. Family notification required within 1 hour."},
  "Near Fall":{immediate:"1. Ensure client is stable and seated safely. 2. Check for dizziness, weakness, or pain. 3. Identify the cause (rug, wet floor, footwear, medication side effect). 4. Remove or mitigate hazard immediately.",report:"Document what caused the near-fall, environmental factors, and client's physical state. Update care plan with new risk factors.",notify:"Notify office same day. Family notification at manager discretion."},
  "Medication Issue":{immediate:"1. Do NOT give a double dose. 2. Note which medication was missed/wrong and the time. 3. Contact MD office or pharmacy for guidance — do not make dosing decisions independently. 4. Monitor for adverse symptoms.",report:"Document which medication, what happened (missed, wrong dose, wrong time, adverse reaction), and MD guidance received.",notify:"Notify office and MD immediately. Family notification required."},
  "Emergency Call":{immediate:"1. Call 911 if life-threatening (chest pain, difficulty breathing, stroke symptoms, unresponsiveness). 2. Stay with client and keep them calm. 3. Do not give food/water/medication unless directed. 4. Gather medication list and insurance info for EMS. 5. Begin CPR if trained and needed.",report:"Document time of onset, symptoms, vitals if obtainable, what 911 was told, hospital transported to, and EMS crew identifier.",notify:"Call office immediately. Family notification required ASAP."},
  "Behavioral Issue":{immediate:"1. Stay calm — do not argue or restrain. 2. Speak slowly in simple sentences. 3. Try to identify the trigger (pain, hunger, overstimulation, UTI). 4. Redirect attention to a preferred activity. 5. Ensure environment is safe. 6. If client is a danger to self or others, call 911.",report:"Document behavior observed, possible trigger, duration, what de-escalation was attempted, and outcome.",notify:"Notify office same day. Family notification at manager discretion unless safety concern."},
  "Skin Issue":{immediate:"1. Do not apply any creams or treatments without MD order. 2. Note size, color, location, and depth of wound or skin change. 3. Keep area clean and dry. 4. If actively bleeding, apply gentle pressure with clean cloth. 5. Take a photo for documentation (with client consent).",report:"Document location (use body map), size in cm, color, drainage, odor, and surrounding skin condition. Note if new or changed.",notify:"Notify office same day. MD referral if open wound or stage 2+ pressure injury."},
  "Client Complaint":{immediate:"1. Listen actively without being defensive. 2. Acknowledge the client's feelings. 3. Apologize for the inconvenience. 4. Take notes on the specific concern. 5. Do not make promises you cannot keep — tell them you will escalate.",report:"Document the exact complaint, client's words, your response, and any immediate action taken.",notify:"Notify office immediately. Manager will determine family communication."},
  "Other":{immediate:"1. Assess the situation for any safety concerns. 2. If unsure, call the office for guidance. 3. Document everything you observe.",report:"Describe the incident in detail: who, what, when, where, and the outcome.",notify:"Notify office same day."},
};

// ─── LOGO ───────────────────────────────────────────────────────────
const LOGO_WHITE="data:image/png;base64,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";
const LOGO_DARK="data:image/png;base64,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";
function Logo({s=38,c="#fff"}){return <img src={c==="#fff"||c==="white"||c==="#FFF"?LOGO_WHITE:LOGO_DARK} width={s} height={s} style={{objectFit:"contain"}} alt="CWIN"/>;}

// ═══════════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════════
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400&family=Inter:wght@300;400;500;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#f5f2eb;--card:#fff;--text:#070707;--t2:#6b6860;--t3:#a8a49c;--bdr:rgba(17,17,17,.1);
  --black:#070707;--white:#ffffff;--green:#020704;--dark:#000201;--slate:#3D3E3F;--ochre:#8a7356;
  --ok:#3c4f3d;--ok-l:rgba(60,79,61,.1);--warn:#8a7356;--warn-l:rgba(138,115,86,.1);--err:#7a3030;--err-l:rgba(122,48,48,.08);
  --blue:#3f4749;--blue-l:rgba(63,71,73,.08);--purple:#4a3f5c;--purple-l:rgba(74,63,92,.08);
  --r:3px;--rs:2px;--sh:none;
  --f:'Inter',system-ui,sans-serif;--fd:'Playfair Display',Georgia,serif;
  --border-thin:1px solid rgba(17,17,17,.1)
}
body{font-family:var(--f);background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;line-height:1.4;font-weight:400}

/* ── LAYOUT ── */
.app{display:flex;min-height:100vh}
.sb{width:220px;background:var(--black);color:var(--white);position:fixed;top:0;left:0;bottom:0;overflow-y:auto;z-index:50;display:flex;flex-direction:column}
.sb-logo{padding:18px 22px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid rgba(255,255,255,.06)}
.sb-sec{padding:22px 22px 8px;font-size:0.6rem;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;opacity:.2}
.ni{display:flex;align-items:center;gap:10px;padding:9px 22px;font-size:12.5px;cursor:pointer;color:rgba(255,255,255,.35);transition:.2s;font-weight:400;border-left:2px solid transparent;letter-spacing:.2px}
.ni:hover{color:rgba(255,255,255,.7);background:rgba(255,255,255,.03)}
.ni.act{color:var(--white);background:rgba(255,255,255,.06);border-left-color:var(--white)}
.ni .ico{width:20px;text-align:center;font-size:13px}
.ni .badge{margin-left:auto;background:rgba(255,255,255,.15);color:var(--white);font-size:9px;font-weight:600;padding:1px 7px;border-radius:2px;min-width:18px;text-align:center}
.main{margin-left:220px;flex:1;padding:28px 36px 60px;min-width:0}

/* ── HEADER ── */
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:var(--border-thin)}
.hdr h2{font-family:var(--fd);font-size:28px;font-weight:400;letter-spacing:-.02em}
.hdr-sub{font-size:11.5px;color:var(--t2);margin-top:4px;letter-spacing:.2px;font-weight:400}

/* ── CARDS ── */
.card{background:var(--card);border:var(--border-thin);margin-bottom:16px;overflow:hidden}
.card-h{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:var(--border-thin)}
.card-h h3{font-size:13px;font-weight:600;letter-spacing:.3px;text-transform:uppercase;font-family:var(--f)}
.card-b{padding:18px 20px}
.card-pad{padding:18px 20px}

/* ── STAT GRID ── */
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:22px}
.sc{background:var(--card);padding:20px;border:var(--border-thin);transition:.2s;position:relative;overflow:hidden}
.sc:hover{background:#faf9f6}
.sc .sl{font-size:0.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--t2);font-weight:600}
.sc .sv{font-family:var(--fd);font-size:32px;font-weight:400;margin:6px 0 3px;letter-spacing:-.02em}
.sc .ss{font-size:11px;color:var(--t2);font-weight:400}
.sc.ok::before,.sc.bl::before,.sc.wn::before,.sc.er::before,.sc.pu::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}
.sc.ok::before{background:var(--ok)}.sc.bl::before{background:var(--blue)}.sc.wn::before{background:var(--ochre)}.sc.er::before{background:var(--err)}.sc.pu::before{background:var(--purple)}

/* ── TABLE ── */
table{width:100%;border-collapse:collapse;font-size:12px}
th{text-align:left;padding:10px 14px;font-size:0.6rem;text-transform:uppercase;letter-spacing:.8px;color:var(--t2);font-weight:600;border-bottom:var(--border-thin);white-space:nowrap;background:transparent}
td{padding:10px 14px;border-bottom:var(--border-thin);vertical-align:top;font-weight:400}
tr:hover td{background:rgba(0,0,0,.015)}
.tw{overflow-x:auto}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:var(--rs);font-size:11.5px;font-weight:500;font-family:var(--f);border:var(--border-thin);cursor:pointer;transition:.15s;white-space:nowrap;letter-spacing:.3px;background:var(--card);color:var(--text)}
.btn:active{transform:scale(.98)}.btn:disabled{opacity:.35;cursor:default}
.btn-p{background:var(--black);color:var(--white);border-color:var(--black)}
.btn-s{background:transparent;color:var(--text);border-color:rgba(17,17,17,.15)}
.btn-ok{background:var(--ok);color:var(--white);border-color:var(--ok)}
.btn-er{background:var(--err);color:var(--white);border-color:var(--err)}
.btn-bl{background:var(--slate);color:var(--white);border-color:var(--slate)}
.btn-sm{padding:5px 12px;font-size:10.5px}

/* ── TAGS ── */
.tag{display:inline-flex;align-items:center;padding:3px 9px;font-size:0.6rem;font-weight:600;letter-spacing:.5px;text-transform:uppercase;border:1px solid}
.tag-ok{background:var(--ok-l);color:var(--ok);border-color:rgba(60,79,61,.2)}
.tag-wn{background:var(--warn-l);color:var(--ochre);border-color:rgba(138,115,86,.2)}
.tag-er{background:var(--err-l);color:var(--err);border-color:rgba(122,48,48,.15)}
.tag-bl{background:var(--blue-l);color:var(--slate);border-color:rgba(63,71,73,.15)}
.tag-pu{background:var(--purple-l);color:var(--purple);border-color:rgba(74,63,92,.15)}

/* ── FORMS ── */
.fg{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
.fi label{display:block;font-size:0.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--t2);margin-bottom:6px}
.fi input,.fi select,.fi textarea{width:100%;padding:10px 12px;border:var(--border-thin);border-radius:0;font-size:13px;font-family:var(--f);outline:none;background:transparent;font-weight:400}
.fi input:focus,.fi select:focus,.fi textarea:focus{border-color:var(--text)}
.fa{display:flex;gap:8px;padding:14px 20px;border-top:var(--border-thin);justify-content:flex-end}

/* ── TAB ROW ── */
.tab-row{display:flex;gap:0;border-bottom:var(--border-thin);margin-bottom:20px}
.tab-btn{padding:10px 20px;font-size:11px;font-weight:500;cursor:pointer;border:none;background:none;color:var(--t2);border-bottom:2px solid transparent;margin-bottom:-1px;font-family:var(--f);transition:.15s;letter-spacing:.3px;text-transform:uppercase}
.tab-btn:hover{color:var(--text)}
.tab-btn.act{color:var(--text);border-bottom-color:var(--text)}

/* ── AI CARDS ── */
.ai-card{background:var(--black);color:var(--white);padding:22px 24px;margin-bottom:16px;position:relative;overflow:hidden}
.ai-card::after{content:'';position:absolute;top:-40px;right:-40px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.03)}
.ai-card h4{font-family:var(--fd);font-size:14px;font-weight:400;margin-bottom:10px;display:flex;align-items:center;gap:8px;letter-spacing:.3px}
.ai-card p{font-size:12px;opacity:.55;line-height:1.7;font-weight:300}

/* ── AVATAR ── */
.avatar{width:36px;height:36px;border-radius:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0;letter-spacing:.5px}

/* ── CHAT ── */
.chat-bubble{max-width:80%;padding:12px 16px;font-size:12.5px;line-height:1.6;margin-bottom:8px}
.chat-cg{background:var(--black);color:var(--white)}
.chat-fam{background:rgba(61,62,63,.08);color:var(--text)}
.chat-meta{font-size:0.6rem;color:var(--t2);margin-bottom:3px;letter-spacing:.3px;text-transform:uppercase}

/* ── PROGRESS ── */
.progress-bar{height:3px;background:rgba(0,0,0,.06);overflow:hidden}
.progress-fill{height:100%;transition:.3s}

/* ── MODAL ── */
.modal-bg{position:fixed;inset:0;background:rgba(7,7,7,.55);z-index:100;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
.modal{background:var(--card);border:var(--border-thin);width:92%;max-width:580px;max-height:85vh;overflow-y:auto}
.modal-h{padding:18px 22px;border-bottom:var(--border-thin);font-family:var(--fd);font-size:17px;font-weight:400;display:flex;justify-content:space-between;align-items:center}
.modal-b{padding:20px 22px}
.modal-f{padding:14px 22px;border-top:var(--border-thin);display:flex;gap:8px;justify-content:flex-end}

/* ── MISC ── */
.empty{text-align:center;padding:36px;color:var(--t3);font-size:12px;letter-spacing:.3px}
.pulse{display:inline-block;width:6px;height:6px;border-radius:50%;animation:pulse 2.5s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}

@media print{.sb,.no-print{display:none!important}.main{margin:0!important;padding:0!important}}

/* ── LOGIN ── */
.login-wrap{min-height:100vh;display:flex;background:var(--bg)}
.login-left{flex:1;background:var(--black);color:var(--white);display:flex;flex-direction:column;justify-content:center;padding:60px}
.login-left h1{font-family:var(--fd);font-size:48px;font-weight:400;letter-spacing:-.02em;margin-bottom:8px}
.login-left .tag-line{font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.3;margin-bottom:40px}
.login-left .role-pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:24px}
.login-left .role-pill{padding:4px 12px;font-size:10px;letter-spacing:.5px;text-transform:uppercase;border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.4)}
.login-right{width:420px;display:flex;flex-direction:column;justify-content:center;padding:60px}
.login-right h2{font-family:var(--fd);font-size:24px;font-weight:400;margin-bottom:6px}
.login-right .sub{font-size:12px;color:var(--t2);margin-bottom:30px}
.login-field{margin-bottom:16px}
.login-field label{display:block;font-size:0.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--t2);margin-bottom:6px}
.login-field input{width:100%;padding:12px 14px;border:var(--border-thin);background:transparent;font-size:14px;font-family:var(--f);outline:none}
.login-field input:focus{border-color:var(--text)}
.login-btn{width:100%;padding:14px;background:var(--black);color:var(--white);border:none;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;cursor:pointer;font-family:var(--f);margin-top:8px;transition:.15s}
.login-btn:hover{opacity:.85}
.login-btn:active{transform:scale(.99)}
.login-err{color:var(--err);font-size:12px;margin-top:10px}
.login-hints{margin-top:30px;padding-top:20px;border-top:var(--border-thin)}
.login-hints .hint{display:flex;justify-content:space-between;padding:4px 0;font-size:11px;color:var(--t2)}
.login-hints .hint span:first-child{font-weight:600;color:var(--text)}
.user-bar{display:flex;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid rgba(255,255,255,.06);cursor:pointer}
.user-bar:hover{background:rgba(255,255,255,.03)}
.user-bar .ub-name{font-size:12px;font-weight:500}
.user-bar .ub-role{font-size:9px;text-transform:uppercase;letter-spacing:1px;opacity:.35}

/* ── CAREGIVER PORTAL ── */
.cg-header{background:var(--black);color:var(--white);padding:24px 30px;margin:-28px -36px 24px;display:flex;justify-content:space-between;align-items:center}
.cg-header h2{font-family:var(--fd);font-size:24px;font-weight:400}
.cg-header .cg-meta{text-align:right;font-size:11px;opacity:.5}
.cg-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px}
.cg-stat{background:var(--card);border:var(--border-thin);padding:16px;text-align:center}
.cg-stat .val{font-family:var(--fd);font-size:24px;font-weight:400;margin:4px 0}
.cg-stat .lbl{font-size:0.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--t2)}

/* ── TIME CLOCK ── */
.clock-panel{background:var(--black);color:var(--white);padding:28px;margin-bottom:16px;position:relative;overflow:hidden}
.clock-panel::after{content:'';position:absolute;top:-50px;right:-50px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.02)}
.clock-panel .timer{font-family:var(--fd);font-size:48px;font-weight:400;letter-spacing:2px;margin:10px 0}
.clock-panel .shift-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px}
.clock-panel .sm-box{background:rgba(255,255,255,.06);padding:10px}
.clock-panel .sm-label{font-size:0.5rem;text-transform:uppercase;letter-spacing:1px;opacity:.4}
.clock-panel .sm-val{font-size:14px;font-weight:500;margin-top:3px}
.clock-btn-row{display:flex;gap:8px;margin-top:18px}
.clock-btn{flex:1;padding:14px;border:none;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;cursor:pointer;font-family:var(--f);transition:.15s}
.clock-btn:active{transform:scale(.98)}
.clock-btn-in{background:var(--white);color:var(--black)}
.clock-btn-out{background:#7a3030;color:var(--white)}
.clock-btn-break{background:rgba(255,255,255,.1);color:var(--white);border:1px solid rgba(255,255,255,.15)}
.gps-indicator{display:flex;align-items:center;gap:6px;font-size:11px;opacity:.5;margin-top:12px}
.gps-dot{width:6px;height:6px;border-radius:50%;background:#3c4f3d;animation:pulse 2.5s infinite}
.gps-trail{display:flex;gap:2px;flex-wrap:wrap;margin-top:10px}
.gps-trail .dot{width:4px;height:4px;border-radius:50%;background:rgba(60,79,61,.5)}
.geofence-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;font-size:10px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-top:8px}
.geofence-in{background:rgba(60,79,61,.15);color:#3c4f3d}
.geofence-out{background:rgba(138,115,86,.15);color:#8a7356}
.shift-history-item{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:var(--border-thin)}
.exp-submit-form{padding:18px 20px;border-bottom:var(--border-thin);background:rgba(0,0,0,.01)}

/* ── RUNNING LATE ── */
.late-banner{background:linear-gradient(135deg,#3d2600,#1a1000);color:var(--white);padding:16px 20px;margin-bottom:14px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden}
.late-banner::after{content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.04)}
.late-banner .late-icon{width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.1);flex-shrink:0;font-size:20px}
.late-banner .late-info{flex:1}
.late-banner .late-title{font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase}
.late-banner .late-eta{font-family:var(--fd);font-size:22px;font-weight:400;margin:2px 0}
.late-banner .late-detail{font-size:11px;opacity:.5}
.late-form{background:var(--card);border:var(--border-thin);margin-bottom:14px;overflow:hidden}
.late-form-header{padding:14px 20px;background:rgba(138,115,86,.08);border-bottom:var(--border-thin);display:flex;align-items:center;gap:8px}
.late-form-header span{font-size:13px;font-weight:600}
.late-form-body{padding:16px 20px}
.eta-display{background:var(--black);color:var(--white);padding:18px;text-align:center;margin-bottom:14px}
.eta-display .eta-time{font-family:var(--fd);font-size:36px;font-weight:400;margin:4px 0}
.eta-display .eta-label{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;opacity:.4}
.eta-display .eta-dist{font-size:12px;opacity:.5;margin-top:4px}
.eta-reasons{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px}
.eta-reason{padding:10px 8px;border:var(--border-thin);text-align:center;font-size:11px;font-weight:600;cursor:pointer;transition:.15s}
.eta-reason.sel{background:var(--black);color:var(--white);border-color:var(--black)}
.late-notif{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(138,115,86,.1);font-size:11px;color:#8a7356;font-weight:600;margin-top:10px}

/* ── SCHEDULER ── */
.week-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.week-nav .wn-center{text-align:center;cursor:pointer}
.week-nav .wn-label{font-size:14px;font-weight:600}
.week-nav .wn-sub{font-size:11px;color:var(--t2);margin-top:1px}
.week-nav button{width:36px;height:36px;border:var(--border-thin);background:var(--card);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;font-family:var(--f)}
.day-cols{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:14px}
.day-col{text-align:center;padding:8px 4px;cursor:pointer;border:var(--border-thin);background:var(--card);transition:.15s}
.day-col:hover{background:rgba(0,0,0,.02)}
.day-col .dc-day{font-size:0.55rem;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.5px}
.day-col .dc-num{font-size:16px;font-weight:600;margin-top:3px}
.day-col .dc-dots{display:flex;gap:2px;justify-content:center;margin-top:5px;min-height:6px}
.day-col .dc-dot{width:5px;height:5px;border-radius:50%}
.day-col.sel{background:var(--black);color:var(--white);border-color:var(--black)}
.day-col.sel .dc-day{color:rgba(255,255,255,.5)}
.day-col.sel .dc-dot{opacity:.7}
.day-col.is-today:not(.sel){border-color:var(--black);border-width:2px}
.shift-block{border:var(--border-thin);margin-bottom:8px;padding:12px 16px;position:relative;cursor:pointer;background:var(--card);transition:.1s}
.shift-block:hover{background:rgba(0,0,0,.015)}
.shift-block::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px}
.publish-bar{background:var(--black);color:var(--white);padding:12px 18px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between}
.publish-bar .pb-text{font-size:12px;font-weight:600}
.publish-bar .pb-sub{font-size:10px;opacity:.4;margin-top:1px}
.conflict-warn{background:rgba(122,48,48,.08);border:1px solid rgba(122,48,48,.15);padding:10px 14px;margin-bottom:10px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--err);font-weight:600}

/* ═══════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE
   ═══════════════════════════════════════════════════════════════ */
@media(max-width:1024px){
  .sb{width:200px}.main{margin-left:200px;padding:20px 22px 50px}
  .sg{grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
  .fg{grid-template-columns:1fr 1fr}.hdr h2{font-size:22px}
}
@media(max-width:768px){
  /* Force inline grid layouts to stack on mobile */
  [style*="grid-template-columns: 1fr 3"],[style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr!important}
  [style*="grid-template-columns: repeat(4"],[style*="grid-template-columns: repeat(5"],[style*="grid-template-columns: repeat(6"]{grid-template-columns:repeat(2,1fr)!important}
  .sb{position:fixed;bottom:0;top:auto;left:0;right:0;width:100%;height:auto;flex-direction:row;overflow-x:auto;overflow-y:hidden;z-index:100;padding:0;border-top:1px solid rgba(255,255,255,.1)}
  .sb-logo,.sb-sec,.user-bar{display:none}
  .sb nav{display:flex;flex-direction:row;overflow-x:auto;-webkit-overflow-scrolling:touch;gap:0;padding:0;flex:1}
  .sb nav::-webkit-scrollbar{display:none}
  .ni{flex-direction:column;padding:8px 12px;gap:3px;border-left:none;border-top:2px solid transparent;font-size:9px;white-space:nowrap;min-width:62px;justify-content:center;align-items:center;text-align:center}
  .ni.act{border-left:none;border-top-color:var(--white)}
  .ni .ico{font-size:16px;width:auto}
  .ni .badge{position:absolute;top:2px;right:2px;margin:0;font-size:7px;padding:0 4px;min-width:14px}
  .ni span:not(.ico):not(.badge){font-size:8px;max-width:54px;overflow:hidden;text-overflow:ellipsis}
  .main{margin-left:0;padding:16px 16px 90px}
  .hdr{flex-direction:column;gap:10px;padding-bottom:14px}
  .hdr h2{font-size:20px}
  .hdr>div:last-child{display:flex;gap:6px;flex-wrap:wrap}
  .sg{grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
  .sc{padding:14px}.sc .sv{font-size:24px}
  .fg{grid-template-columns:1fr;gap:10px}
  .card-h{padding:12px 14px}.card-h h3{font-size:11px}
  .card-b,.card-pad{padding:14px}
  .tw{-webkit-overflow-scrolling:touch}table{min-width:600px}
  th,td{padding:8px 10px;font-size:11px}
  .btn{padding:10px 16px;font-size:12px;min-height:40px}
  .btn-sm{padding:8px 12px;font-size:11px;min-height:34px}
  .tag{padding:3px 7px;font-size:0.55rem}
  .tab-row{overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap;padding-bottom:2px}
  .tab-row::-webkit-scrollbar{display:none}
  .tab-btn{padding:10px 14px;font-size:10px;white-space:nowrap;flex-shrink:0}
  .ai-card{padding:16px 18px}.ai-card h4{font-size:13px}.ai-card p{font-size:11px}
  .modal-bg{align-items:flex-end}
  .modal{width:100%;max-width:100%;max-height:92vh;border:none}
  .modal-h{padding:14px 16px;font-size:15px}
  .modal-b{padding:14px 16px}.modal-f{padding:10px 16px}
  .login-wrap{flex-direction:column}
  .login-left{padding:40px 24px 30px;min-height:auto}
  .login-left h1{font-size:36px}
  .login-right{width:100%;padding:30px 24px 40px}
  .login-right h2{font-size:20px}
  .login-hints .hint{flex-direction:column;gap:2px;padding:6px 0}
  .login-field input{padding:14px;font-size:16px}
  .login-btn{padding:16px;font-size:13px}
  .cg-header{margin:-16px -16px 16px;padding:20px 16px}
  .cg-header h2{font-size:20px}.cg-header .cg-meta{font-size:10px}
  .cg-stat-grid{grid-template-columns:1fr 1fr 1fr;gap:6px}
  .cg-stat{padding:12px 8px}.cg-stat .val{font-size:20px}.cg-stat .lbl{font-size:0.5rem}
  .clock-panel{padding:20px 16px;margin-left:-16px;margin-right:-16px;width:calc(100% + 32px)}
  .clock-panel .timer{font-size:36px}
  .clock-panel .shift-meta{grid-template-columns:1fr 1fr;gap:6px}
  .clock-btn-row{flex-direction:column;gap:6px}
  .clock-btn{padding:16px}
  .shift-history-item{flex-direction:column;gap:6px;align-items:flex-start;padding:10px 14px}
  .chat-bubble{max-width:90%;font-size:12px;padding:10px 12px}
  .progress-bar{height:4px}
  .avatar{width:32px;height:32px;font-size:10px}
  .exp-submit-form{padding:14px}
  .geofence-badge{font-size:9px;padding:3px 8px}
  .gps-trail .dot{width:3px;height:3px}
  .gps-indicator{font-size:10px}
  .late-banner{padding:12px 14px;gap:10px}
  .late-banner .late-icon{width:36px;height:36px;font-size:16px}
  .late-banner .late-eta{font-size:18px}
  .late-banner .late-detail{font-size:9px}
  .late-form-body{padding:14px}
  .eta-display{padding:14px}
  .eta-display .eta-time{font-size:28px}
  .eta-reasons{grid-template-columns:1fr 1fr}
  .eta-reason{padding:8px 6px;font-size:10px}
  .late-notif{font-size:10px;padding:6px 10px}
  .day-cols{grid-template-columns:repeat(7,1fr);gap:2px}
  .day-col{padding:6px 2px}
  .day-col .dc-day{font-size:0.45rem}
  .day-col .dc-num{font-size:13px}
  .day-col .dc-dot{width:4px;height:4px}
  .shift-block{padding:10px 12px;margin-bottom:6px}
  .publish-bar{padding:10px 14px;flex-direction:column;gap:8px;text-align:center}
  .week-nav button{width:32px;height:32px;font-size:12px}
}
@media(max-width:400px){
  .main{padding:12px 12px 90px}
  .sg{grid-template-columns:1fr 1fr;gap:6px}
  .sc{padding:10px}.sc .sv{font-size:20px}.sc .sl{font-size:0.5rem}
  .hdr h2{font-size:18px}
  .cg-header{padding:16px 12px}.cg-header h2{font-size:18px}
  .cg-stat-grid{grid-template-columns:1fr 1fr;gap:5px}
  .clock-panel .timer{font-size:30px}
  .login-left{padding:30px 20px 20px}.login-left h1{font-size:28px}
  .login-right{padding:24px 20px 30px}
  .tab-btn{padding:8px 10px;font-size:9px}
  .ni{padding:6px 8px;min-width:54px}.ni .ico{font-size:14px}
}
@media(hover:none){
  .btn{min-height:44px}.btn-sm{min-height:38px}
  .ni{min-height:52px}
  .fi input,.fi select,.fi textarea{min-height:44px;font-size:16px}
  .tab-btn{min-height:40px}
  .login-field input{min-height:48px}
}
`;

// ═══════════════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════════════
function LoginScreen({onLogin}){
  const [email,setEmail]=useState("");
  const [pin,setPin]=useState("");
  const [err,setErr]=useState("");
  const submit=()=>{
    const u=USERS.find(u=>u.email===email&&u.pin===pin&&u.active);
    if(u)onLogin(u); else setErr("Invalid credentials");
  };
  return <div className="login-wrap">
    <div className="login-left">
      <Logo s={240} c="#fff"/>
      <div style={{height:28}}/>
      <div style={{fontSize:15,opacity:.7,lineHeight:1.7,maxWidth:400,fontWeight:500,letterSpacing:.3}}>Home Care Operations Portal</div>
      <div style={{fontSize:12,opacity:.35,lineHeight:1.7,maxWidth:400,marginTop:4}}>Compliance, billing, workforce training, and family engagement in one system.</div>
      <div className="role-pills">
        {Object.values(ROLES).map(r=> <div key={r.label} className="role-pill">{r.label}</div>)}
      </div>
    </div>
    <div className="login-right">
      <h2>Sign In</h2>
      <div className="sub">Enter your credentials to access your portal</div>
      <div className="login-field"><label>Email</label><input type="email" placeholder="you@cwinathome.com" value={email} onChange={e=>{setEmail(e.target.value);setErr("");}}/></div>
      <div className="login-field"><label>PIN</label><input type="password" placeholder="••••" maxLength={4} value={pin} onChange={e=>{setPin(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
      <button className="login-btn" onClick={submit}>Sign In</button>
      {err&& <div className="login-err">{err}</div>}
      <div className="login-hints">
        <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"var(--t2)",fontWeight:600,marginBottom:8}}>Demo Accounts</div>
        {[{e:"kip@cwinathome.com",p:"1234",r:"Owner"},{e:"admin@cwinathome.com",p:"4321",r:"Admin"},{e:"erolyn@cwinathome.com",p:"1111",r:"Caregiver"},{e:"becky.sutton@email.com",p:"5555",r:"Client"},{e:"tom.sutton@email.com",p:"8888",r:"Family"}].map(h=> <div key={h.e} className="hint" style={{cursor:"pointer"}} onClick={()=>{setEmail(h.e);setPin(h.p);}}>
          <span>{h.r}</span><span>{h.e} / {h.p}</span>
        </div>)}
      </div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// CAREGIVER HOME PORTAL
// ═══════════════════════════════════════════════════════════════════════
// ─── CAREGIVER SCHEDULE VIEW (read-only) ────────────────────────────
function CGScheduleView({user,schedules,clients}){
  const [weekStart,setWS]=useState(getMonday(now()));
  const [selDay,setSD]=useState(toISO(now()));
  const weekDates=Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const mySched=schedules.filter(s=>s.caregiverId===user.caregiverId&&s.status==="published");
  const weekSched=mySched.filter(s=>s.date>=toISO(weekStart)&&s.date<=toISO(addDays(weekStart,6)));
  const daySched=mySched.filter(s=>s.date===selDay).sort((a,b)=>a.startTime.localeCompare(b.startTime));
  const weekHrs=weekSched.reduce((s,sh)=>s+(timeToMin(sh.endTime)-timeToMin(sh.startTime))/60,0);

  return <div>
    <div className="cg-stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:14}}>
      <div className="cg-stat"><div className="lbl">This Week</div><div className="val">{weekSched.length}</div><div className="lbl">shifts</div></div>
      <div className="cg-stat"><div className="lbl">Hours</div><div className="val">{weekHrs.toFixed(0)}</div><div className="lbl">scheduled</div></div>
      <div className="cg-stat"><div className="lbl">Clients</div><div className="val">{new Set(weekSched.map(s=>s.clientId)).size}</div><div className="lbl">this week</div></div>
    </div>
    <div className="week-nav">
      <button onClick={()=>setWS(addDays(weekStart,-7))}>←</button>
      <div className="wn-center" onClick={()=>{setWS(getMonday(now()));setSD(toISO(now()));}}><div className="wn-label">{fmtShort(weekStart)} — {fmtShort(addDays(weekStart,6))}</div><div className="wn-sub">Tap for today</div></div>
      <button onClick={()=>setWS(addDays(weekStart,7))}>→</button>
    </div>
    <div className="day-cols">
      {weekDates.map((d,i)=>{const iso=toISO(d);const ct=mySched.filter(s=>s.date===iso).length;
        return <div key={i} className={`day-col ${iso===selDay?"sel":""} ${iso===toISO(now())?"is-today":""}`} onClick={()=>setSD(iso)}>
          <div className="dc-day">{DAYS[i]}</div><div className="dc-num">{d.getDate()}</div>
          <div className="dc-dots">{Array.from({length:Math.min(ct,4)}).map((_,j)=> <div key={j} className="dc-dot" style={{background:iso===selDay?"rgba(255,255,255,.6)":"#3c4f3d"}}/>)}</div>
        </div>;
      })}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <div style={{fontWeight:600,fontSize:13}}>{fromISO(selDay).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}{selDay===toISO(now())&&<span style={{color:"#3c4f3d",marginLeft:6,fontSize:11}}>TODAY</span>}</div>
      <div style={{fontSize:12,color:"var(--t2)"}}>{daySched.length} shift{daySched.length!==1?"s":""}</div>
    </div>
    {daySched.length===0&& <div className="card card-b empty">No shifts on {fromISO(selDay).toLocaleDateString("en-US",{weekday:"long"})}</div>}
    {daySched.map(s=>{const cl=clients.find(c=>c.id===s.clientId);const hrs=((timeToMin(s.endTime)-timeToMin(s.startTime))/60).toFixed(1);
      return <div key={s.id} className="shift-block" style={{cursor:"default"}}>
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:s.color||"#3c4f3d"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{paddingLeft:10}}>
            <div style={{fontSize:14,fontWeight:600}}>{s.startTime} — {s.endTime} <span style={{fontWeight:400,color:"var(--t2)",fontSize:12}}>({hrs}h)</span></div>
            <div style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:400,marginTop:2}}>{cl?.name}</div>
            <div style={{fontSize:11,color:"var(--t2)",marginTop:3}}>📍 {cl?.addr}</div>
            {s.notes&& <div style={{fontSize:11,color:"#8a7356",marginTop:4,fontWeight:600}}>📝 {s.notes}</div>}
          </div>
          <span className="tag tag-ok">{s.tasks.length} tasks</span>
        </div>
        {s.tasks.length>0&& <div style={{marginTop:10,paddingLeft:10,display:"flex",gap:4,flexWrap:"wrap"}}>
          {s.tasks.map((t,i)=> <span key={i} style={{fontSize:10,padding:"2px 8px",background:"var(--bg)",border:"var(--border-thin)",color:"var(--t2)"}}>{t}</span>)}
        </div>}
      </div>;
    })}
  </div>;
}

function CaregiverPortal({user,clients,caregivers,careNotes,setCareNotes,incidents,setIncidents,expenses,setExpenses,events,chores,schedules,trainingProgress,setTrainingProgress,familyMsgs,setFamilyMsgs,modal,setModal,notify,assignments,incidentPrompts,getAssignedClients,allUsers,onReferCG,onReferClient}){
  const [tab,setTab]=useState("home");
  const [shift,setShift]=useState(null);
  const [shiftHistory,setShiftHistory]=useState([]);
  const [gpsTrail,setGpsTrail]=useState([]);
  const [clockTime,setClockTime]=useState(now());
  const [travel,setTravel]=useState({miles:0,segments:[]});
  const [showExpForm,setShowExpForm]=useState(false);
  const [viewReceipt,setViewReceipt]=useState(null);
  const [expForm,setExpForm]=useState({clientId:"",category:"Mileage",description:"",amount:0,quantity:0,receipt:false,receiptNote:"",receiptPhoto:null});
  const [lateAlert,setLateAlert]=useState(null);
  const [showLateForm,setShowLateForm]=useState(null);
  const [lateReason,setLateReason]=useState("Traffic");
  const [lateMinutes,setLateMinutes]=useState(15);
  const [lateHistory,setLateHistory]=useState([]);
  const [incidentRec,setIncidentRec]=useState(null);
  const gpsRef=useRef(null);
  const cg=caregivers.find(c=>c.id===user.caregiverId);

  // Filter clients by assignment
  const myClients=getAssignedClients?getAssignedClients(user.caregiverId):clients;

  const myNotes=careNotes.filter(n=>n.caregiverId===user.caregiverId).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const myExpenses=expenses.filter(e=>e.caregiverId===user.caregiverId);
  const myChores=chores.filter(ch=>ch.assignedTo===user.caregiverId);
  const myTraining=(trainingProgress[user.caregiverId]||[]);
  const pct=Math.round(myTraining.length/TRAINING_MODULES.length*100);

  // Clock tick
  useEffect(()=>{const t=setInterval(()=>setClockTime(now()),1000);return()=>clearInterval(t);},[]);

  // GPS tracking during shift
  useEffect(()=>{
    if(shift){
      gpsRef.current=setInterval(()=>{
        const loc=GPS_LOCATIONS[shift.clientId];
        if(loc){const pos=simGPS(loc);setGpsTrail(p=>[...p,pos]);}
      },4000);
      return()=>clearInterval(gpsRef.current);
    } else { if(gpsRef.current)clearInterval(gpsRef.current); }
  },[shift]);

  const clockIn=(clientId)=>{
    const loc=GPS_LOCATIONS[clientId];
    if(!loc)return;
    const gps=simGPS(loc);
    const addr=gpsAddr(gps.lat,gps.lng);
    const inFence=Math.abs(gps.lat-loc.lat)+Math.abs(gps.lng-loc.lng)<0.005;
    setShift({id:"SH"+uid(),clientId,clientName:loc.name,clockInTime:now(),clockInGPS:gps,clockInAddr:addr,inFence,breaks:[],onBreak:false});
    setGpsTrail([gps]);
    // Notify client, owner, admin
    if(notify){
      const cl=clients.find(c=>c.id===clientId);
      const msg=`${user.name} has clocked in for ${cl?.name||"client"} at ${addr}`;
      notify(clientId,"clock_in","Caregiver Arrived",msg,{caregiverId:user.caregiverId});
      notify("U1","clock_in","Clock In",msg,{caregiverId:user.caregiverId,clientId});
      notify("U2","clock_in","Clock In",msg,{caregiverId:user.caregiverId,clientId});
    }
  };

  const clockOut=()=>{
    if(!shift)return;
    const loc=GPS_LOCATIONS[shift.clientId];
    const gps=loc?simGPS(loc):{lat:0,lng:0};
    const dur=Math.round((now()-shift.clockInTime)/60000);
    const breakMins=shift.breaks.reduce((s,b)=>s+(b.end?(b.end-b.start)/60000:0),0);
    const completed={...shift,clockOutTime:now(),clockOutGPS:gps,clockOutAddr:gpsAddr(gps.lat,gps.lng),duration:dur,workMins:dur-Math.round(breakMins),breakMins:Math.round(breakMins),gpsPoints:gpsTrail.length};
    setShiftHistory(p=>[completed,...p]);
    if(shiftHistory.length>0){
      const last=shiftHistory[0];
      const d=gpsDist(last.clockOutGPS||last.clockInGPS,shift.clockInGPS);
      if(d>0.5) setTravel(p=>({miles:p.miles+d,segments:[...p.segments,{from:last.clientName,to:shift.clientName,miles:d}]}));
    }
    setShift(null);setGpsTrail([]);
  };

  const toggleBreak=()=>{
    if(!shift)return;
    if(shift.onBreak) setShift(s=>({...s,onBreak:false,breaks:s.breaks.map((b,i)=>i===s.breaks.length-1?{...b,end:now()}:b)}));
    else setShift(s=>({...s,onBreak:true,breaks:[...s.breaks,{start:now(),end:null}]}));
  };

  const shiftDur=shift?Math.round((clockTime-shift.clockInTime)/60000):0;
  const breakMin=shift?shift.breaks.reduce((s,b)=>s+(b.end?(b.end-b.start)/60000:(clockTime-b.start)/60000),0):0;
  const workMin=shiftDur-Math.round(breakMin);

  const submitExpense=async()=>{
    if(!expForm.description||(!expForm.amount&&!expForm.quantity))return;
    const total=expForm.category==="Mileage"?expForm.quantity*MILEAGE_RATE:expForm.amount;
    const loc=GPS_LOCATIONS[expForm.clientId||shift?.clientId];
    const gps=loc?simGPS(loc):null;
    const cid=expForm.clientId||shift?.clientId||"";
    const expId="EX"+uid();
    // Upload receipt to Supabase if there's a photo
    let photoUrl=expForm.receiptPhoto;
    if(expForm.receiptPhoto&&expForm.receiptPhoto.startsWith("data:")){
      const uploaded=await sbUploadReceipt(expForm.receiptPhoto,expId);
      if(uploaded)photoUrl=uploaded;
    }
    const exp={id:expId,caregiverId:user.caregiverId,clientId:cid,date:today(),category:expForm.category,description:expForm.description,amount:total,receipt:expForm.receipt,receiptNote:expForm.receiptNote||"",receiptPhoto:photoUrl,status:"pending",gps:gps?gpsAddr(gps.lat,gps.lng):"",adminApproved:false};
    setExpenses(p=>[exp,...p]);
    setExpForm({clientId:cid,category:"Mileage",description:"",amount:0,quantity:0,receipt:false,receiptNote:"",receiptPhoto:null});
    setShowExpForm(false);
    // Notify admin only (not client)
    if(notify){
      const cl=clients.find(c=>c.id===cid);
      notify("U1","expense","Expense Submitted",`${user.name} submitted ${expForm.category} expense of $${total.toFixed(2)} for ${cl?.name||"—"}: ${expForm.description}`,{expenseId:exp.id});
      notify("U2","expense","Expense Submitted",`${user.name} submitted ${expForm.category} expense of $${total.toFixed(2)} for ${cl?.name||"—"}: ${expForm.description}`,{expenseId:exp.id});
    }
  };

  // ── RUNNING LATE WITH GPS ETA ──
  const calcETA=(clientId)=>{
    const dest=GPS_LOCATIONS[clientId];
    if(!dest)return{dist:0,eta:15,addr:""};
    // Simulate current position (e.g. caregiver's home area)
    const currentGPS={lat:dest.lat+(Math.random()-.5)*.06,lng:dest.lng+(Math.random()-.5)*.06};
    const miles=gpsDist(currentGPS,dest);
    const driveMin=Math.max(5,Math.round(miles/0.4)); // ~24mph city avg
    return{dist:miles,eta:driveMin,currentGPS,destGPS:dest,addr:gpsAddr(currentGPS.lat,currentGPS.lng),destAddr:dest.addr};
  };

  const sendLateAlert=(clientId)=>{
    const cl=clients.find(c=>c.id===clientId);
    const calc=calcETA(clientId);
    const etaMins=lateMinutes||calc.eta;
    const arrivalTime=new Date(now().getTime()+etaMins*60000);
    const arrivalStr=arrivalTime.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
    const alert={id:"LA"+uid(),clientId,clientName:cl?.name||"",reason:lateReason,etaMinutes:etaMins,arrivalTime,gps:calc.currentGPS,currentAddr:calc.addr,destAddr:calc.destAddr,distance:calc.dist,sentAt:now(),caregiver:user.name,caregiverId:user.caregiverId};
    setLateAlert(alert);
    setLateHistory(p=>[alert,...p]);
    setShowLateForm(null);
    // Notify client, owner, admin, and family
    if(notify){
      const clientMsg=`Hi ${cl?.name}, your caregiver ${user.name} is running approximately ${etaMins} minutes late. Reason: ${lateReason}. Expected arrival: ${arrivalStr}. We apologize for the inconvenience. Call 708-476-0021 with questions.`;
      const adminMsg=`LATE ALERT: ${user.name} is running ${etaMins} min late to ${cl?.name}. Reason: ${lateReason}. ETA: ${arrivalStr} (${calc.dist.toFixed(1)} mi away). Current location: ${calc.addr||"GPS tracking"}.`;
      const familyMsg=`CWIN Care Update: ${user.name} is running approximately ${etaMins} minutes late to ${cl?.name}'s visit. Reason: ${lateReason}. Expected arrival: ${arrivalStr}. Call 708-476-0021 with questions.`;
      const meta={caregiverId:user.caregiverId,caregiverName:user.name,clientId,clientName:cl?.name,eta:etaMins,reason:lateReason,arrivalTime:arrivalStr,distance:calc.dist?.toFixed(1)};
      // Notify client
      notify(clientId,"running_late","Caregiver Running Late",clientMsg,meta);
      // Notify owner + admin
      notify("U1","running_late","⚠️ Caregiver Late Alert",adminMsg,meta);
      notify("U2","running_late","⚠️ Caregiver Late Alert",adminMsg,meta);
      // Notify family contacts
      const familyContacts=cl?.familyPortal?.contacts||[];
      familyContacts.forEach(fc=>{
        const fUser=allUsers?.find(u=>u.email===fc.email);
        if(fUser)notify(fUser.id,"running_late","Caregiver Running Late",familyMsg,meta);
      });
    }
  };

  const dismissLate=()=>setLateAlert(null);

  const tabs=[
    {key:"home",label:"Home"},{key:"timeclock",label:"Time Clock"},{key:"schedule",label:"Schedule"},{key:"clients",label:"My Clients"},{key:"notes",label:"Care Notes"},
    {key:"expenses",label:"Expenses"},{key:"training",label:"Training"},{key:"messages",label:"Messages"},{key:"refer",label:"📣 Refer"},
  ];

  return <div>
    <div className="cg-header">
      <div><div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1.5,opacity:.3,marginBottom:4}}>Caregiver Portal</div><h2>Welcome, {user.name.split(" ")[0]}</h2></div>
      <div className="cg-meta">
        <div>{cg?.certs?.join(" | ")}</div>
        <div style={{marginTop:2}}>{clockTime.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
        {shift&& <div style={{marginTop:4,color:"#3c4f3d",fontWeight:600}}>● ON SHIFT</div>}
      </div>
    </div>
    <div className="tab-row">{tabs.map(t=> <button key={t.key} className={`tab-btn ${tab===t.key?"act":""}`} onClick={()=>setTab(t.key)}>{t.label}{t.key==="timeclock"&&shift?" ●":""}</button>)}</div>

    {/* ═══ HOME ═══ */}
    {tab==="home"&& <div>
      {/* Running Late Banner */}
      {lateAlert&& <div className="late-banner" style={{cursor:"pointer"}} onClick={()=>setTab("timeclock")}>
        <div className="late-icon">⏰</div>
        <div className="late-info">
          <div className="late-title">Running Late — {lateAlert.clientName}</div>
          <div className="late-eta">ETA {lateAlert.etaMinutes} min</div>
          <div className="late-detail">{lateAlert.reason} | {lateAlert.distance.toFixed(1)} mi away | Tap to manage</div>
        </div>
      </div>}

      {/* Active Shift Banner */}
      {shift&& (()=>{const isL=!!lateAlert&&lateAlert.clientId===shift.clientId;const bg=shift.onBreak?"#4a4a4a":isL?"#6b4400":"#1a3a1a";const ac=shift.onBreak?"#888":isL?"#ffa94d":"#4ade80";const st=shift.onBreak?"On Break":isL?"Running Late":"On Shift";
        return <div style={{background:bg,color:"#fff",padding:"18px 24px",marginBottom:16,cursor:"pointer",position:"relative",overflow:"hidden",transition:"background .4s"}} onClick={()=>setTab("timeclock")}>
        <div style={{position:"absolute",top:-30,right:-30,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:ac,animation:shift.onBreak?"none":"pulse 2.5s infinite"}}/><span style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,opacity:.6,fontWeight:600}}>{st}</span></div><div style={{fontSize:16,fontWeight:500,marginTop:4}}>{shift.clientName}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontFamily:"var(--fd)",fontSize:32,fontWeight:400,color:ac}}>{String(Math.floor(workMin/60)).padStart(2,"0")}:{String(workMin%60).padStart(2,"0")}</div><div style={{fontSize:10,opacity:.4}}>TAP TO MANAGE</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,opacity:.5,marginTop:8}}><div style={{width:5,height:5,borderRadius:"50%",background:ac,animation:"pulse 2.5s infinite"}}/>GPS tracking | {gpsTrail.length} points</div>
      </div>;})()}

      <div style={{marginBottom:16,overflow:"hidden",border:"var(--border-thin)"}}>
        <div style={{background:"var(--black)",color:"var(--white)",padding:"16px 22px",display:"flex",alignItems:"center",gap:8}}>
          <span className="pulse" style={{background:"#3c4f3d"}}/>
          <span style={{fontFamily:"var(--fd)",fontSize:15,fontWeight:400,letterSpacing:.3}}>Today's Summary</span>
          <span style={{marginLeft:"auto",fontSize:10,opacity:.35}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</span>
        </div>
        <div style={{background:"var(--card)",padding:"18px 22px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:12,marginBottom:14}}>
            <div style={{padding:"12px 14px",background:"var(--bg)"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>My Clients</div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,marginTop:2}}>{myClients.length}</div><div style={{fontSize:10,color:"var(--t2)"}}>assigned</div></div>
            <div style={{padding:"12px 14px",background:"var(--bg)"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Tasks</div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,marginTop:2}}>{myChores.length}</div><div style={{fontSize:10,color:"var(--t2)"}}>open</div></div>
            <div style={{padding:"12px 14px",background:"var(--bg)"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Care Notes</div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,marginTop:2}}>{myNotes.length}</div><div style={{fontSize:10,color:"var(--t2)"}}>total</div></div>
            <div style={{padding:"12px 14px",background:"var(--bg)"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Training</div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,marginTop:2,color:pct>=80?"#3c4f3d":"#8a7356"}}>{pct}%</div><div style={{fontSize:10,color:"var(--t2)"}}>{myTraining.length}/{TRAINING_MODULES.length} modules</div></div>
            <div style={{padding:"12px 14px",background:"var(--bg)"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Shifts Today</div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,marginTop:2}}>{shiftHistory.length}</div><div style={{fontSize:10,color:"var(--t2)"}}>{shiftHistory.reduce((s,sh)=>s+sh.workMins,0)} min worked</div></div>
            <div style={{padding:"12px 14px",background:"var(--bg)"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Expenses</div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,marginTop:2}}>{myExpenses.filter(e=>e.status==="pending").length}</div><div style={{fontSize:10,color:"var(--t2)"}}>pending approval</div></div>
            {travel.miles>0&&<div style={{padding:"12px 14px",background:"var(--bg)"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Travel</div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,marginTop:2}}>{travel.miles.toFixed(1)} mi</div><div style={{fontSize:10,color:"var(--t2)"}}>${(travel.miles*MILEAGE_RATE).toFixed(2)} reimbursable</div></div>}
          </div>
          {(myExpenses.filter(e=>e.status==="pending").length>0||pct<80||shiftHistory.length===0)&&<div style={{fontSize:12,color:"var(--t2)",lineHeight:1.7,padding:"10px 14px",background:"rgba(138,115,86,.06)",borderLeft:"3px solid #8a7356"}}>
            {myExpenses.filter(e=>e.status==="pending").length>0&&<span>💰 {myExpenses.filter(e=>e.status==="pending").length} expense{myExpenses.filter(e=>e.status==="pending").length!==1?"s":""} awaiting office approval. </span>}
            {pct<80&&<span>🎓 Training at {pct}% — complete remaining modules to reach compliance. </span>}
            {shiftHistory.length===0&&shift===null&&<span>⏰ No shifts clocked today. Tap Time Clock to begin. </span>}
          </div>}
        </div>
      </div>

      <div className="card"><div className="card-h"><h3>Recent Notes</h3></div>
        {myNotes.slice(0,5).map(n=>{const cl=clients.find(c=>c.id===n.clientId);return <div key={n.id} style={{padding:"10px 20px",borderBottom:"var(--border-thin)"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t2)",marginBottom:4}}><span style={{fontWeight:600}}>{cl?.name}</span><span>{fmtRel(n.date)}</span></div>
          <div style={{fontSize:12.5,lineHeight:1.6}}>{n.text.slice(0,150)}{n.text.length>150?"...":""}</div>
          {n.photos&&n.photos.length>0&&<div style={{display:"flex",gap:4,marginTop:6}}>{n.photos.slice(0,4).map(ph=><img key={ph.id} src={ph.url} alt="Task" style={{width:36,height:36,objectFit:"cover",border:"var(--border-thin)"}}/>)}{n.photos.length>4&&<span style={{fontSize:10,color:"var(--t2)",alignSelf:"center"}}>+{n.photos.length-4}</span>}</div>}
        </div>;})}
      </div>
    </div>}

    {/* ═══ TIME CLOCK ═══ */}
    {tab==="timeclock"&& <div>

      {/* Running Late Active Banner */}
      {lateAlert&& <div className="late-banner">
        <div className="late-icon">⏰</div>
        <div className="late-info">
          <div className="late-title">Running Late — {lateAlert.clientName}</div>
          <div className="late-eta">ETA {lateAlert.etaMinutes} min</div>
          <div className="late-detail">{lateAlert.reason} | {lateAlert.distance.toFixed(1)} mi away | Sent {fmtT(lateAlert.sentAt)}</div>
          <div className="late-detail">📍 Current: {lateAlert.currentAddr}</div>
          <div className="late-detail">🏠 Destination: {lateAlert.destAddr}</div>
        </div>
        <button className="btn btn-sm" style={{background:"rgba(255,255,255,.15)",color:"#fff",border:"none"}} onClick={dismissLate}>✕</button>
      </div>}

      {/* Running Late Form */}
      {showLateForm&& <div className="late-form">
        <div className="late-form-header"><span>⏰ Running Late — {clients.find(c=>c.id===showLateForm)?.name}</span></div>
        <div className="late-form-body">
          {(()=>{const calc=calcETA(showLateForm);return <div className="eta-display">
            <div className="eta-label">GPS-Based ETA</div>
            <div className="eta-time">{calc.eta} min</div>
            <div className="eta-dist">{calc.dist.toFixed(1)} miles from {clients.find(c=>c.id===showLateForm)?.name}</div>
            <div style={{fontSize:10,opacity:.3,marginTop:6}}>📍 Your location: {calc.addr}</div>
          </div>;})()}
          <div className="fi" style={{marginBottom:14}}><label>Reason</label>
            <div className="eta-reasons">
              {["Traffic","Car trouble","Previous visit ran long","Personal emergency","Weather","Public transit delay","Other"].map(r=> <div key={r} className={`eta-reason ${lateReason===r?"sel":""}`} onClick={()=>setLateReason(r)}>{r}</div>)}
            </div>
          </div>
          <div className="fi" style={{marginBottom:14}}><label>Override ETA (minutes)</label>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {[5,10,15,20,30,45].map(m=> <button key={m} className={`btn btn-sm ${lateMinutes===m?"btn-p":"btn-s"}`} onClick={()=>setLateMinutes(m)}>{m}</button>)}
              <input type="number" value={lateMinutes} onChange={e=>setLateMinutes(+e.target.value)} style={{width:60,padding:"6px 8px",border:"var(--border-thin)",fontSize:13,textAlign:"center"}} min={1} max={120}/>
            </div>
          </div>
          <div className="late-notif">📨 This will notify: Office, assigned caregiver team, and family contacts (if enabled)</div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button className="btn btn-p" style={{flex:1,background:"#8a7356",borderColor:"#8a7356"}} onClick={()=>sendLateAlert(showLateForm)}>⏰ Send Late Alert with ETA</button>
            <button className="btn btn-s" onClick={()=>setShowLateForm(null)}>Cancel</button>
          </div>
        </div>
      </div>}

      {shift? (()=>{
        const isLate=!!lateAlert&&lateAlert.clientId===shift.clientId;
        const clockBg=shift.onBreak?"#4a4a4a":isLate?"#6b4400":"#1a3a1a";
        const clockAccent=shift.onBreak?"#888":isLate?"#ffa94d":"#4ade80";
        const statusLabel=shift.onBreak?"On Break":isLate?"Running Late":"On Shift";
        const statusDot=shift.onBreak?"#888":isLate?"#ffa94d":"#4ade80";
        return <div>
        {/* Active Shift Panel */}
        <div style={{background:clockBg,color:"#fff",padding:28,marginBottom:16,position:"relative",overflow:"hidden",transition:"background .4s"}}>
          <div style={{position:"absolute",top:-50,right:-50,width:150,height:150,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:statusDot,animation:shift.onBreak?"none":"pulse 2.5s infinite"}}/>
                <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,opacity:.6,fontWeight:600}}>{statusLabel}</div>
              </div>
              <div style={{fontSize:18,fontWeight:500,marginTop:6}}>{shift.clientName}</div>
            </div>
            <div className={`geofence-badge ${shift.inFence?"geofence-in":"geofence-out"}`}>{shift.inFence?"Inside Geofence":"Outside Geofence"}</div>
          </div>
          <div style={{fontFamily:"var(--fd)",fontSize:48,fontWeight:400,letterSpacing:2,margin:"10px 0",color:clockAccent}}>{String(Math.floor(workMin/60)).padStart(2,"0")}:{String(workMin%60).padStart(2,"0")}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:16}}>
            <div style={{background:"rgba(255,255,255,.06)",padding:10}}><div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,opacity:.4}}>Clock In</div><div style={{fontSize:14,fontWeight:500,marginTop:3}}>{fmtT(shift.clockInTime)}</div></div>
            <div style={{background:"rgba(255,255,255,.06)",padding:10}}><div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,opacity:.4}}>Break</div><div style={{fontSize:14,fontWeight:500,marginTop:3}}>{Math.round(breakMin)}m</div></div>
            <div style={{background:"rgba(255,255,255,.06)",padding:10}}><div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,opacity:.4}}>GPS Points</div><div style={{fontSize:14,fontWeight:500,marginTop:3}}>{gpsTrail.length}</div></div>
            <div style={{background:"rgba(255,255,255,.06)",padding:10}}><div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,opacity:.4}}>Accuracy</div><div style={{fontSize:14,fontWeight:500,marginTop:3}}>{gpsTrail.length>0?`${gpsTrail[gpsTrail.length-1].accuracy.toFixed(0)}m`:"—"}</div></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,opacity:.5,marginTop:12}}><div style={{width:6,height:6,borderRadius:"50%",background:clockAccent,animation:"pulse 2.5s infinite"}}/>📍 {shift.clockInAddr}</div>
          {gpsTrail.length>0&& <div style={{fontSize:10,opacity:.3,marginTop:4}}>{gpsTrail[gpsTrail.length-1].lat.toFixed(5)}°N, {Math.abs(gpsTrail[gpsTrail.length-1].lng).toFixed(5)}°W</div>}
          <div className="gps-trail">{gpsTrail.slice(-80).map((_,i)=> <div key={i} className="dot" style={{opacity:.3+((i/80)*.7),background:clockAccent}}/>)}</div>
          <div className="clock-btn-row">
            <button className={`clock-btn ${shift.onBreak?"clock-btn-in":"clock-btn-break"}`} onClick={toggleBreak}>{shift.onBreak?"▶ Resume":"⏸ Break"}</button>
            <button className="clock-btn clock-btn-out" onClick={clockOut}>⏹ Clock Out</button>
          </div>
        </div>

        {/* Quick Actions During Shift */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
          <button className="btn btn-p" style={{padding:14,flexDirection:"column",gap:4}} onClick={()=>setModal("note")}>📝 Note</button>
          <button className="btn btn-s" style={{padding:14,flexDirection:"column",gap:4}} onClick={()=>{setShowExpForm(true);setExpForm(f=>({...f,clientId:shift.clientId}));}}>💰 Expense</button>
          <button className="btn btn-s" style={{padding:14,flexDirection:"column",gap:4}} onClick={()=>setModal("incident")}>⚠️ Incident</button>
          <button className="btn btn-s" style={{padding:14,flexDirection:"column",gap:4,color:"#8a7356",borderColor:"rgba(138,115,86,.3)"}} onClick={()=>{const nextCl=myClients.find(c=>c.id!==shift.clientId);if(nextCl)setShowLateForm(nextCl.id);}}>⏰ Late</button>
        </div>
      </div>;})()

      : <div>
        {/* Clock In Selector */}
        <div style={{fontFamily:"var(--fd)",fontSize:18,marginBottom:16}}>Clock In</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
          {myClients.map(cl=>{const loc=GPS_LOCATIONS[cl.id];const hasLateAlert=lateAlert&&lateAlert.clientId===cl.id;return <div key={cl.id} className="card" style={{overflow:"hidden"}}>
            {hasLateAlert&& <div style={{background:"rgba(138,115,86,.1)",padding:"8px 14px",display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#8a7356",fontWeight:600,borderBottom:"var(--border-thin)"}}>⏰ Late alert sent — ETA {lateAlert.etaMinutes} min ({lateAlert.reason})</div>}
            <div className="card-b" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:400}}>{cl.name}</div>
                <div style={{fontSize:12,color:"var(--t2)",marginTop:2}}>📍 {loc?.addr||cl.addr}</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button className="btn btn-sm btn-s" style={{color:"#8a7356",borderColor:"rgba(138,115,86,.3)"}} onClick={(e)=>{e.stopPropagation();setShowLateForm(cl.id);setLateMinutes(calcETA(cl.id).eta);}}>⏰ Late</button>
                <button className="btn btn-p" onClick={()=>clockIn(cl.id)}>Clock In →</button>
              </div>
            </div>
          </div>;})}
        </div>

        {/* Late Alert History */}
        {lateHistory.length>0&& <div className="card" style={{marginTop:16}}>
          <div className="card-h"><h3>Late Notifications Sent</h3></div>
          {lateHistory.map(la=> <div key={la.id} style={{padding:"10px 20px",borderBottom:"var(--border-thin)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:600,fontSize:13}}>⏰ {la.clientName} — {la.reason}</div>
              <div style={{fontSize:11,color:"var(--t2)",marginTop:2}}>ETA {la.etaMinutes} min | {la.distance.toFixed(1)} mi | Sent {fmtT(la.sentAt)}</div>
              <div style={{fontSize:10,color:"var(--t3)",marginTop:1}}>📍 From: {la.currentAddr}</div>
            </div>
            <span className="tag tag-wn">Notified</span>
          </div>)}
        </div>}
      </div>}

      {/* Travel Summary */}
      {travel.miles>0&& <div className="card" style={{marginTop:16}}>
        <div className="card-h"><h3>Travel Today</h3><span className="tag tag-ok">{travel.miles.toFixed(1)} mi | ${(travel.miles*MILEAGE_RATE).toFixed(2)}</span></div>
        {travel.segments.map((seg,i)=> <div key={i} className="shift-history-item">
          <div><div style={{fontWeight:600,fontSize:13}}>{seg.from} → {seg.to}</div><div style={{fontSize:11,color:"var(--t2)"}}>{seg.miles.toFixed(1)} miles × ${MILEAGE_RATE}/mi</div></div>
          <div style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:400}}>${(seg.miles*MILEAGE_RATE).toFixed(2)}</div>
        </div>)}
      </div>}

      {/* Shift History */}
      {shiftHistory.length>0&& <div className="card" style={{marginTop:16}}>
        <div className="card-h"><h3>Completed Shifts</h3></div>
        {shiftHistory.map(sh=> <div key={sh.id} className="shift-history-item">
          <div>
            <div style={{fontWeight:600,fontSize:13}}>{sh.clientName}</div>
            <div style={{fontSize:11,color:"var(--t2)"}}>{fmtT(sh.clockInTime)} — {fmtT(sh.clockOutTime)} | {hrsMin(sh.workMins)} worked | {sh.breakMins}m break</div>
            <div style={{fontSize:10,color:"var(--t2)",marginTop:2}}>📍 {sh.clockInAddr} | {sh.gpsPoints} GPS points</div>
          </div>
          <span className="tag tag-ok">Complete</span>
        </div>)}
      </div>}
    </div>}

    {/* ═══ SCHEDULE ═══ */}
    {tab==="schedule"&& <CGScheduleView user={user} schedules={schedules} clients={clients}/>}

    {/* ═══ CLIENTS ═══ */}
    {tab==="clients"&& <div>
      {myClients.map(cl=> <div key={cl.id} className="card card-b">
        <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:12}}>
          <ProfileAvatar name={cl.name} photo={cl.photo} size={48} dark/>
          <div style={{flex:1}}><div style={{fontFamily:"var(--fd)",fontSize:18,fontWeight:400}}>{cl.name}</div><div style={{fontSize:12,color:"var(--t2)"}}>{cl.addr}</div></div>
          <span className={`tag tag-${cl.riskLevel==="low"?"ok":cl.riskLevel==="medium"?"wn":"er"}`}>{cl.riskLevel}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <div style={{background:"var(--bg)",padding:10}}><div style={{fontSize:9,color:"var(--t2)",textTransform:"uppercase",letterSpacing:.5}}>Diagnoses</div><div style={{fontSize:12,fontWeight:600,marginTop:2}}>{cl.dx.length}</div></div>
          <div style={{background:"var(--bg)",padding:10}}><div style={{fontSize:9,color:"var(--t2)",textTransform:"uppercase",letterSpacing:.5}}>Medications</div><div style={{fontSize:12,fontWeight:600,marginTop:2}}>{cl.meds.length}</div></div>
          <div style={{background:"var(--bg)",padding:10}}><div style={{fontSize:9,color:"var(--t2)",textTransform:"uppercase",letterSpacing:.5}}>Diet</div><div style={{fontSize:12,fontWeight:600,marginTop:2}}>{cl.preferences.diet}</div></div>
        </div>
      </div>)}
    </div>}

    {/* ═══ NOTES ═══ */}
    {tab==="notes"&& <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><h3 style={{fontFamily:"var(--fd)",fontSize:16}}>My Care Notes</h3><button className="btn btn-p btn-sm" onClick={()=>setModal("note")}>+ New Note</button></div>
      <div className="card">{myNotes.map(n=>{const cl=clients.find(c=>c.id===n.clientId);return <div key={n.id} style={{padding:"12px 20px",borderBottom:"var(--border-thin)"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}><div style={{display:"flex",gap:6}}><span className={`tag ${NOTE_CATS[n.category]?.color||"tag-ok"}`}>{n.category}</span><span style={{fontWeight:600}}>{cl?.name}</span></div><span style={{color:"var(--t2)"}}>{fmtD(n.date)}</span></div>
        <div style={{fontSize:13,lineHeight:1.6}}>{n.text}</div>
        {n.photos&&n.photos.length>0&&<div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>{n.photos.map(ph=><a key={ph.id} href={ph.url} target="_blank" rel="noopener noreferrer"><img src={ph.url} alt="Task" style={{width:60,height:60,objectFit:"cover",border:"var(--border-thin)",cursor:"pointer"}}/></a>)}</div>}
      </div>;})}
      {myNotes.length===0&& <div className="empty">No care notes yet</div>}
      </div>
    </div>}

    {/* ═══ EXPENSES ═══ */}
    {tab==="expenses"&& <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h3 style={{fontFamily:"var(--fd)",fontSize:16}}>My Expenses</h3>
        <button className="btn btn-p btn-sm" onClick={()=>setShowExpForm(!showExpForm)}>+ Log Expense</button>
      </div>

      <div className="cg-stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
        <div className="cg-stat"><div className="lbl">Pending</div><div className="val" style={{color:"var(--ochre)"}}>${myExpenses.filter(e=>e.status==="pending").reduce((s,e)=>s+e.amount,0).toFixed(2)}</div></div>
        <div className="cg-stat"><div className="lbl">Approved</div><div className="val" style={{color:"var(--ok)"}}>${myExpenses.filter(e=>e.status==="approved").reduce((s,e)=>s+e.amount,0).toFixed(2)}</div></div>
        <div className="cg-stat"><div className="lbl">Travel Miles</div><div className="val">{travel.miles.toFixed(1)}</div></div>
        <div className="cg-stat"><div className="lbl">Travel $</div><div className="val">${(travel.miles*MILEAGE_RATE).toFixed(2)}</div></div>
      </div>

      {/* Expense Submission Form */}


      {/* Auto-Travel Mileage */}
      {travel.segments.length>0&& <div className="card">
        <div className="card-h"><h3>Auto-Tracked Mileage (GPS)</h3><span className="tag tag-ok">GPS</span></div>
        {travel.segments.map((seg,i)=> <div key={i} className="shift-history-item">
          <div><div style={{fontWeight:600,fontSize:13}}>{seg.from} → {seg.to}</div><div style={{fontSize:11,color:"var(--t2)"}}>{seg.miles.toFixed(1)} mi × ${MILEAGE_RATE}/mi</div></div>
          <div style={{fontFamily:"var(--fd)",fontSize:16}}>${(seg.miles*MILEAGE_RATE).toFixed(2)}</div>
        </div>)}
      </div>}

      {/* Expense History */}
      <div className="card"><div className="card-h"><h3>Submitted Expenses</h3></div>
        <div className="tw"><table><thead><tr><th>Date</th><th>Client</th><th>Category</th><th>Description</th><th>GPS</th><th>Receipt</th><th style={{textAlign:"right"}}>Amount</th><th>Status</th></tr></thead><tbody>
          {myExpenses.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>{const cl=clients.find(c=>c.id===e.clientId);return <tr key={e.id}><td>{fmtD(e.date)}</td><td style={{fontWeight:600}}>{cl?.name||"—"}</td><td><span className="tag tag-bl">{e.category}</span></td><td>{e.description}</td><td style={{fontSize:10}} title={e.gps}>{e.gps?"📍 "+e.gps.split(",")[0]:"—"}</td><td>{e.receiptPhoto?<img src={e.receiptPhoto} alt="Receipt" style={{width:32,height:32,objectFit:"cover",cursor:"pointer",border:"var(--border-thin)"}} onClick={()=>setViewReceipt(e)}/>:e.receipt?"📷":"—"}</td><td style={{textAlign:"right",fontWeight:600}}>${e.amount.toFixed(2)}</td><td><span className={`tag ${e.status==="approved"?"tag-ok":"tag-wn"}`}>{e.status}</span></td></tr>;})}
        </tbody></table></div>
        {myExpenses.length===0&& <div className="empty">No expenses submitted yet</div>}
      </div>
      {/* Caregiver Receipt Viewer */}
      {viewReceipt&& <div className="modal-bg" onClick={()=>setViewReceipt(null)}>
        <div className="modal" style={{maxWidth:600,maxHeight:"90vh",overflow:"auto"}} onClick={ev=>ev.stopPropagation()}>
          <div className="modal-h">Receipt — {viewReceipt.description}<button className="btn btn-sm btn-s" onClick={()=>setViewReceipt(null)}>✕</button></div>
          <div className="modal-b" style={{textAlign:"center"}}>
            <img src={viewReceipt.receiptPhoto} alt="Receipt" style={{maxWidth:"100%",maxHeight:"60vh",border:"var(--border-thin)"}}/>
            <div style={{marginTop:12,padding:"10px 14px",background:"var(--bg)",fontSize:12,textAlign:"left"}}>
              {viewReceipt.receiptNote&&<div style={{marginBottom:6}}><strong>Receipt details:</strong> {viewReceipt.receiptNote}</div>}
              <div><strong>Date:</strong> {fmtD(viewReceipt.date)} · <strong>Amount:</strong> ${viewReceipt.amount.toFixed(2)}</div>
              <div><strong>Status:</strong> <span className={`tag ${viewReceipt.status==="approved"?"tag-ok":"tag-wn"}`}>{viewReceipt.status}</span></div>
            </div>
          </div>
        </div>
      </div>}
    </div>}

    {/* ═══ TRAINING ═══ */}
    {tab==="training"&& <div>
      <div style={{marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"var(--t2)"}}>Progress: {myTraining.length}/{TRAINING_MODULES.length} modules</span><span style={{fontSize:14,fontWeight:600}}>{pct}%</span></div>
        <div className="progress-bar"><div className="progress-fill" style={{width:`${pct}%`,background:pct===100?"var(--ok)":"var(--blue)"}}/></div>
      </div>
      {TRAINING_MODULES.map((mod,idx)=>{const done=myTraining.includes(idx);return <div key={mod.id} className="card card-b" style={{display:"flex",justifyContent:"space-between",alignItems:"center",opacity:done?.6:1}}>
        <div><div style={{fontWeight:600,fontSize:13}}>{mod.title}</div><div style={{fontSize:11,color:"var(--t2)",marginTop:2}}>{mod.category} | {mod.duration} | {mod.lessons.length} lessons</div></div>
        {done? <span className="tag tag-ok">Complete</span>:<button className="btn btn-sm btn-p" onClick={()=>setTrainingProgress(p=>({...p,[user.caregiverId]:[...(p[user.caregiverId]||[]),idx]}))}>Start</button>}
      </div>;})}
    </div>}

    {/* ═══ MESSAGES ═══ */}
    {tab==="messages"&& (()=>{
      const [msgText,setMT]=useState("");
      const sendMsg=()=>{if(!msgText.trim())return;
        const cid=myClients[0]?.id||"";
        const msg={id:"FM"+uid(),clientId:cid,from:user.name,fromType:"caregiver",date:now().toISOString(),text:msgText};
        setFamilyMsgs(p=>[...p,msg]);
        // Copy to admin
        if(notify) notify("U2","message","Message",`${user.name} → client chat: ${msgText.slice(0,100)}`,{clientId:cid});
        setMT("");
      };
      return <div>
      <div className="card" style={{maxHeight:"60vh",display:"flex",flexDirection:"column"}}>
        <div className="card-h"><h3>Team Messages</h3></div>
        <div style={{flex:1,overflow:"auto",padding:"14px 20px",display:"flex",flexDirection:"column",gap:6}}>
          {familyMsgs.filter(m=>myClients.some(c=>c.id===m.clientId)).map(m=> <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:m.from===user.name?"flex-end":"flex-start"}}>
            <div className="chat-meta">{m.from} | {fmtRel(m.date)}</div>
            <div className={`chat-bubble ${m.from===user.name?"chat-fam":"chat-cg"}`}>{m.text}</div>
          </div>)}
        </div>
        <div style={{padding:"10px 14px",borderTop:"var(--border-thin)",display:"flex",gap:8}}>
          <input value={msgText} onChange={e=>setMT(e.target.value)} placeholder="Message care team..." style={{flex:1,padding:"8px 12px",border:"var(--border-thin)",fontSize:13,fontFamily:"var(--f)"}} onKeyDown={e=>e.key==="Enter"&&sendMsg()}/>
          <button className="btn btn-p btn-sm" onClick={sendMsg} disabled={!msgText.trim()}>Send</button>
        </div>
        <div style={{padding:"4px 14px 8px",fontSize:9,color:"var(--t2)"}}>Messages are copied to admin</div>
      </div>
    </div>;})()}

    {/* ═══ MODALS ═══ */}
    {modal==="note"&& <div className="modal-bg" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">New Care Note<button className="btn btn-sm btn-s" onClick={()=>setModal(null)}>✕</button></div>
      <NoteForm clients={myClients.length>0?myClients:clients} caregivers={[cg].filter(Boolean)} onSave={n=>{
        setCareNotes(p=>[{id:"CN"+uid(),...n,caregiverId:user.caregiverId,date:now().toISOString()},...p]);
        // Copy note as message to admin
        if(notify){const cl=clients.find(c=>c.id===n.clientId);notify("U2","care_note","Care Note",`${user.name} → ${cl?.name}: ${n.text.slice(0,100)}`,{clientId:n.clientId});}
        setModal(null);
      }}/>
    </div></div>}

    {modal==="incident"&& <div className="modal-bg" onClick={()=>setModal(null)}><div className="modal" style={{maxWidth:640}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">Incident Report<button className="btn btn-sm btn-s" onClick={()=>setModal(null)}>✕</button></div>
      <IncidentForm clients={myClients.length>0?myClients:clients} caregivers={[cg].filter(Boolean)} onSave={inc=>{
        const newInc={id:"IR"+uid(),...inc,caregiverId:user.caregiverId,date:now().toISOString(),status:"open",adminApproved:false,visibleToClient:false};
        setIncidents(p=>[newInc,...p]);
        // Show AI recommendations
        const prompts=incidentPrompts||DEFAULT_INCIDENT_PROMPTS;
        const rec=prompts[inc.type]||prompts["Other"];
        setIncidentRec({incident:newInc,rec});
        // Notify admin + owner
        if(notify){
          const cl=clients.find(c=>c.id===inc.clientId);
          notify("U1","incident",`Incident: ${inc.type}`,`${user.name} reported ${inc.type} (${inc.severity}) for ${cl?.name}: ${inc.description.slice(0,120)}`,{incidentId:newInc.id,clientId:inc.clientId});
          notify("U2","incident",`Incident: ${inc.type}`,`${user.name} reported ${inc.type} (${inc.severity}) for ${cl?.name}: ${inc.description.slice(0,120)}`,{incidentId:newInc.id,clientId:inc.clientId});
        }
        setModal(null);
      }}/>
    </div></div>}

    {/* Incident AI Recommendation Panel */}
    {incidentRec&& <div className="modal-bg" onClick={()=>setIncidentRec(null)}><div className="modal" style={{maxWidth:640}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h" style={{background:"var(--err-l)"}}>⚠️ Incident Reported — AI Response Guide<button className="btn btn-sm btn-s" onClick={()=>setIncidentRec(null)}>✕</button></div>
      <div className="modal-b">
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <span className={`tag ${incidentRec.incident.severity==="low"?"tag-wn":"tag-er"}`}>{incidentRec.incident.type}</span>
          <span className={`tag ${incidentRec.incident.severity==="low"?"tag-wn":"tag-er"}`}>{incidentRec.incident.severity} severity</span>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--err)",marginBottom:8}}>⚡ Immediate Actions</div>
          <div style={{padding:14,background:"var(--err-l)",borderLeft:"3px solid var(--err)",fontSize:12,lineHeight:1.8,whiteSpace:"pre-line"}}>{incidentRec.rec.immediate}</div>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"#8a7356",marginBottom:8}}>📝 Documentation Required</div>
          <div style={{padding:14,background:"var(--warn-l)",borderLeft:"3px solid #8a7356",fontSize:12,lineHeight:1.8,whiteSpace:"pre-line"}}>{incidentRec.rec.report}</div>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--blue)",marginBottom:8}}>📞 Notification Requirements</div>
          <div style={{padding:14,background:"var(--blue-l)",borderLeft:"3px solid var(--blue)",fontSize:12,lineHeight:1.8,whiteSpace:"pre-line"}}>{incidentRec.rec.notify}</div>
        </div>

        <div style={{padding:12,background:"var(--bg)",fontSize:11,color:"var(--t2)",lineHeight:1.6}}>
          ✅ Admin and owner have been automatically notified. This incident will appear in your caregiver portal. The admin will review and determine if it should be shared with the client/family portal.
        </div>
        <button className="btn btn-p" style={{width:"100%",marginTop:12}} onClick={()=>setIncidentRec(null)}>I Understand — Close</button>
      </div>
    </div></div>}

    {/* Global Expense Modal (works from any tab including Time Clock) */}
    {showExpForm&& <div className="modal-bg" onClick={()=>setShowExpForm(false)}><div className="modal" style={{maxWidth:560}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">Submit Expense<button className="btn btn-sm btn-s" onClick={()=>setShowExpForm(false)}>✕</button></div>
      <div className="modal-b">
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Client</label><select value={expForm.clientId} onChange={e=>setExpForm(f=>({...f,clientId:e.target.value}))}><option value="">Select</option>{myClients.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="fi"><label>Category</label><select value={expForm.category} onChange={e=>setExpForm(f=>({...f,category:e.target.value}))}>{EXP_CATEGORIES.map(c=> <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div className="fi" style={{marginBottom:12}}><label>Description</label><input value={expForm.description} onChange={e=>setExpForm(f=>({...f,description:e.target.value}))} placeholder={expForm.category==="Mileage"?"e.g. Round trip to client":"Describe purchase"}/></div>
        {expForm.category==="Mileage"? <div className="fg" style={{gap:8,marginBottom:12}}>
          <div className="fi"><label>Miles</label><input type="number" value={expForm.quantity||""} onChange={e=>setExpForm(f=>({...f,quantity:+e.target.value}))} step="0.1"/></div>
          <div className="fi"><label>Rate</label><input value={`$${MILEAGE_RATE}/mi`} readOnly style={{background:"var(--bg)"}}/></div>
          <div className="fi"><label>Total</label><input value={`$${((expForm.quantity||0)*MILEAGE_RATE).toFixed(2)}`} readOnly style={{background:"var(--bg)",fontWeight:700}}/></div>
        </div>
        : <div className="fi" style={{marginBottom:12}}><label>Amount ($)</label><input type="number" value={expForm.amount||""} onChange={e=>setExpForm(f=>({...f,amount:+e.target.value}))} step="0.01"/></div>}

        {/* Receipt Section */}
        <div style={{padding:14,background:"var(--bg)",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)",marginBottom:8}}>Receipt Documentation</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <input type="checkbox" id="rcpt" checked={expForm.receipt} onChange={e=>setExpForm(f=>({...f,receipt:e.target.checked}))}/>
            <label htmlFor="rcpt" style={{fontSize:13,cursor:"pointer"}}>I have a receipt for this expense</label>
          </div>
          {expForm.receipt&& <div>
            <div className="fi" style={{marginBottom:8}}><label>Receipt Details (store, last 4 digits, total shown)</label><input value={expForm.receiptNote} onChange={e=>setExpForm(f=>({...f,receiptNote:e.target.value}))} placeholder="e.g. Jewel-Osco receipt #4421, total $67.42"/></div>
            <div style={{marginTop:10}}>
              <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:6}}>📸 Receipt Photo</label>
              {expForm.receiptPhoto? <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <img src={expForm.receiptPhoto} alt="Receipt" style={{maxWidth:140,maxHeight:200,border:"var(--border-thin)",objectFit:"cover"}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"var(--ok)",fontWeight:600,marginBottom:6}}>✓ Receipt photo attached</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <label className="btn btn-sm btn-s" style={{cursor:"pointer"}}>
                      📷 Replace
                      <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async(e)=>{
                        const file=e.target.files[0];if(!file)return;
                        if(!file.type.startsWith("image/")){alert("Please select an image");return;}
                        if(file.size>5*1024*1024){alert("Image must be under 5MB");return;}
                        const reader=new FileReader();
                        reader.onload=(ev)=>{
                          const img=new Image();
                          img.onload=()=>{
                            const canvas=document.createElement("canvas");
                            const max=800;let w=img.width,h=img.height;
                            if(w>h){if(w>max){h=h*(max/w);w=max;}}else{if(h>max){w=w*(max/h);h=max;}}
                            canvas.width=w;canvas.height=h;
                            canvas.getContext("2d").drawImage(img,0,0,w,h);
                            setExpForm(f=>({...f,receiptPhoto:canvas.toDataURL("image/jpeg",0.85)}));
                          };
                          img.src=ev.target.result;
                        };
                        reader.readAsDataURL(file);
                      }}/>
                    </label>
                    <button type="button" className="btn btn-sm btn-s" style={{color:"var(--err)"}} onClick={()=>setExpForm(f=>({...f,receiptPhoto:null}))}>🗑 Remove</button>
                  </div>
                </div>
              </div>
              :
              <div>
                <label className="btn btn-p" style={{cursor:"pointer",display:"inline-flex",gap:6,alignItems:"center"}}>
                  📷 Take Photo / Upload Receipt
                  <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async(e)=>{
                    const file=e.target.files[0];if(!file)return;
                    if(!file.type.startsWith("image/")){alert("Please select an image");return;}
                    if(file.size>5*1024*1024){alert("Image must be under 5MB");return;}
                    const reader=new FileReader();
                    reader.onload=(ev)=>{
                      const img=new Image();
                      img.onload=()=>{
                        const canvas=document.createElement("canvas");
                        const max=800;let w=img.width,h=img.height;
                        if(w>h){if(w>max){h=h*(max/w);w=max;}}else{if(h>max){w=w*(max/h);h=max;}}
                        canvas.width=w;canvas.height=h;
                        canvas.getContext("2d").drawImage(img,0,0,w,h);
                        setExpForm(f=>({...f,receiptPhoto:canvas.toDataURL("image/jpeg",0.85)}));
                      };
                      img.src=ev.target.result;
                    };
                    reader.readAsDataURL(file);
                  }}/>
                </label>
                <div style={{fontSize:10,color:"var(--t2)",marginTop:6}}>📱 On mobile, this will open your camera. Receipt is saved with the expense and visible to admin.</div>
              </div>}
            </div>
          </div>}
        </div>

        {expForm.clientId&&GPS_LOCATIONS[expForm.clientId]&& <div style={{fontSize:11,color:"var(--t2)",marginBottom:10}}>📍 GPS: {GPS_LOCATIONS[expForm.clientId].addr}</div>}
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-p" style={{flex:1}} onClick={submitExpense} disabled={!expForm.description||(expForm.category==="Mileage"?!expForm.quantity:!expForm.amount)}>Submit Expense</button>
          <button className="btn btn-s" onClick={()=>setShowExpForm(false)}>Cancel</button>
        </div>
        <div style={{fontSize:10,color:"var(--t2)",marginTop:8,textAlign:"center"}}>Expenses are sent to admin for approval. They will not appear on client billing until approved.</div>
      </div>
    </div></div>}

    {/* ═══ REFER ═══ */}
    {tab==="refer"&& <ReferralForm referrerName={user.name} referrerRole="Caregiver" onReferCG={onReferCG} onReferClient={onReferClient}/>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// FAMILY STANDALONE PORTAL
// ═══════════════════════════════════════════════════════════════════════
function FamilyStandalonePortal({user,clients,caregivers,careNotes,events,familyMsgs,setFamilyMsgs,incidents,schedules,expenses,vitals,invoices,assignments,notifications,notify,onReferCG,onReferClient}){
  const cl=clients.find(c=>c.id===user.clientId)||clients[0];
  const [tab,setTab]=useState("home");
  const [msgText,setMsgText]=useState("");
  const [calMonth,setCalMonth]=useState(now().getMonth());
  const [calYear,setCalYear]=useState(now().getFullYear());

  const clNotes=careNotes.filter(n=>n.clientId===cl.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const clEvents=events.filter(e=>e.clientId===cl.id).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const clMsgs=familyMsgs.filter(m=>m.clientId===cl.id).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const clInc=incidents.filter(i=>i.clientId===cl.id&&(i.visibleToClient||i.familyNotified));
  const clScheds=(schedules||[]).filter(s=>s.clientId===cl.id&&s.status==="published").sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime));
  const clVitals=(vitals||[]).filter(v=>v.clientId===cl.id).sort((a,b)=>b.date.localeCompare(a.date));
  const clExp=(expenses||[]).filter(e=>e.clientId===cl.id&&(e.status==="approved"||e.adminApproved));
  const clInv=(invoices||[]).filter(i=>i.clientId===cl.id);
  const assignedCGs=(assignments||[]).filter(a=>a.clientId===cl.id&&a.status==="active").map(a=>caregivers.find(c=>c.id===a.caregiverId)).filter(Boolean);
  const clNotifs=(notifications||[]).filter(n=>n.to===cl.id||n.to===user.clientId).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const todayScheds=clScheds.filter(s=>s.date===toISO(now()));

  const sendMsg=()=>{if(!msgText.trim())return;
    setFamilyMsgs(p=>[...p,{id:"FM"+uid(),clientId:cl.id,from:user.name,fromType:"family",date:now().toISOString(),text:msgText}]);
    if(notify)notify("U2","message",`Family Message: ${user.name}`,`${user.name} → care team: ${msgText.slice(0,100)}`,{clientId:cl.id});
    setMsgText("");
  };

  // Calendar
  const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const firstDow=new Date(calYear,calMonth,1).getDay();
  const blanks=Array.from({length:firstDow===0?6:(firstDow-1)});
  const calDays=Array.from({length:daysInMonth},(_,i)=>{const d=new Date(calYear,calMonth,i+1);const iso=toISO(d);return{d,iso,day:i+1,dow:d.getDay(),sch:clScheds.filter(s=>s.date===iso),ev:clEvents.filter(e=>e.date&&e.date.startsWith(iso)),isToday:iso===toISO(now())};});

  const tabs=[
    {key:"home",label:"🏠 Home"},{key:"schedule",label:"📅 Schedule"},{key:"notes",label:"📝 Notes"},
    {key:"meds",label:"💊 Meds"},{key:"messages",label:"💬 Messages"},{key:"billing",label:"📊 Billing"},
    {key:"team",label:"👩‍⚕️ Team"},{key:"alerts",label:"🔔 Alerts"},{key:"refer",label:"📣 Refer"},
  ];

  return <div>
    {/* Header */}
    <div style={{background:"var(--black)",color:"#fff",padding:"24px 30px",margin:"-16px -16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:2,opacity:.3,marginBottom:6}}>CWIN Family Portal</div>
        <div style={{fontFamily:"var(--fd)",fontSize:24,fontWeight:400}}>{cl.name}'s Care</div>
        <div style={{fontSize:12,opacity:.5,marginTop:4}}>Logged in as {user.name} ({user.title})</div>
      </div>
      <ProfileAvatar name={cl.name} photo={cl.photo} size={56} dark/>
    </div>

    <div className="tab-row">{tabs.map(t=> <button key={t.key} className={`tab-btn ${tab===t.key?"act":""}`} onClick={()=>setTab(t.key)}>{t.label}</button>)}</div>

    {/* ═══ HOME ═══ */}
    {tab==="home"&& <div>
      {/* Today's Status */}
      <div style={{marginBottom:16,border:"var(--border-thin)",overflow:"hidden"}}>
        <div style={{background:"var(--black)",color:"#fff",padding:"14px 20px",display:"flex",alignItems:"center",gap:8}}>
          <span className="pulse" style={{background:"#4ade80"}}/>
          <span style={{fontFamily:"var(--fd)",fontSize:15,fontWeight:400}}>Today — {now().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</span>
        </div>
        <div style={{background:"var(--card)",padding:"16px 20px"}}>
          {todayScheds.length>0? <div>
            {todayScheds.map(s=>{const cg=caregivers.find(c=>c.id===s.caregiverId);return <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"var(--border-thin)"}}>
              <div>
                <div style={{fontSize:15,fontWeight:600}}>{cg?.name}</div>
                <div style={{fontSize:13,color:"var(--t2)",marginTop:2}}>{s.startTime} — {s.endTime}</div>
                {s.tasks?.length>0&&<div style={{fontSize:11,color:"var(--t2)",marginTop:4}}>{s.tasks.slice(0,3).join(" • ")}{s.tasks.length>3?` +${s.tasks.length-3} more`:""}</div>}
              </div>
              <span className="tag tag-ok" style={{fontSize:10}}>Scheduled</span>
            </div>;})}
          </div>
          : <div style={{textAlign:"center",padding:16,color:"var(--t2)",fontSize:13}}>No visits scheduled today</div>}
        </div>
      </div>

      {/* Quick status cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
        <div style={{background:"var(--card)",border:"var(--border-thin)",padding:16,textAlign:"center"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Care Team</div><div style={{fontFamily:"var(--fd)",fontSize:24,fontWeight:400,marginTop:4}}>{assignedCGs.length}</div><div style={{fontSize:10,color:"var(--t2)"}}>caregivers</div></div>
        <div style={{background:"var(--card)",border:"var(--border-thin)",padding:16,textAlign:"center"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>This Week</div><div style={{fontFamily:"var(--fd)",fontSize:24,fontWeight:400,marginTop:4}}>{clScheds.filter(s=>{const d=fromISO(s.date);const w=getMonday(now());return d>=w&&d<=addDays(w,6);}).length}</div><div style={{fontSize:10,color:"var(--t2)"}}>visits</div></div>
        <div style={{background:"var(--card)",border:"var(--border-thin)",padding:16,textAlign:"center"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Medications</div><div style={{fontFamily:"var(--fd)",fontSize:24,fontWeight:400,marginTop:4}}>{cl.meds?.length||0}</div><div style={{fontSize:10,color:"var(--t2)"}}>active</div></div>
        <div style={{background:"var(--card)",border:"var(--border-thin)",padding:16,textAlign:"center"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Alerts</div><div style={{fontFamily:"var(--fd)",fontSize:24,fontWeight:400,marginTop:4,color:clNotifs.filter(n=>!n.read).length>0?"#8a7356":"var(--text)"}}>{clNotifs.filter(n=>!n.read).length}</div><div style={{fontSize:10,color:"var(--t2)"}}>unread</div></div>
      </div>

      {/* Recent updates */}
      <div className="card"><div className="card-h"><h3>Recent updates</h3></div>
        {clNotes.slice(0,4).map(n=>{const cg=caregivers.find(c=>c.id===n.caregiverId);return <div key={n.id} style={{padding:"12px 20px",borderBottom:"var(--border-thin)"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t2)",marginBottom:4}}><span style={{fontWeight:600}}>{cg?.name}</span><span>{fmtRel(n.date)}</span></div>
          <div style={{fontSize:13,lineHeight:1.6}}>{n.text.slice(0,180)}{n.text.length>180?"...":""}</div>
        </div>;})}
        {clNotes.length===0&&<div className="empty">No updates yet</div>}
      </div>
    </div>}

    {/* ═══ SCHEDULE / CALENDAR ═══ */}
    {tab==="schedule"&& <div>
      {/* Month Nav */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <button className="btn btn-sm btn-s" onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}}>←</button>
        <div style={{textAlign:"center",cursor:"pointer"}} onClick={()=>{setCalMonth(now().getMonth());setCalYear(now().getFullYear());}}>
          <div style={{fontFamily:"var(--fd)",fontSize:18,fontWeight:400}}>{monthNames[calMonth]} {calYear}</div>
        </div>
        <button className="btn btn-sm btn-s" onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}}>→</button>
      </div>

      {/* Calendar Grid */}
      <div className="card" style={{overflow:"visible",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"var(--border-thin)"}}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=> <div key={d} style={{padding:"8px 4px",textAlign:"center",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:"var(--t2)"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {blanks.map((_,i)=> <div key={"b"+i} style={{minHeight:60,borderRight:"var(--border-thin)",borderBottom:"var(--border-thin)",background:"var(--bg)",opacity:.3}}/>)}
          {calDays.map(cd=>{const we=cd.dow===0||cd.dow===6;const past=new Date(cd.iso)<now()&&!cd.isToday;
            return <div key={cd.day} style={{minHeight:60,borderRight:"var(--border-thin)",borderBottom:"var(--border-thin)",padding:"3px 4px",background:cd.isToday?"rgba(60,79,61,.06)":we?"rgba(0,0,0,.015)":"var(--card)"}}>
              <div style={{fontSize:11,fontWeight:cd.isToday?700:400,color:cd.isToday?"#3c4f3d":we?"var(--t3)":"var(--text)"}}>{cd.day}</div>
              {cd.sch.map((s,i)=>{const cg=caregivers.find(c=>c.id===s.caregiverId);return <div key={i} style={{fontSize:7,padding:"1px 3px",marginTop:1,background:past?"rgba(122,48,48,.12)":"#3c4f3d",color:past?"#7a3030":"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.startTime} {cg?.name?.split(" ")[0]}</div>;})}
              {cd.ev.map((e,i)=> <div key={"e"+i} style={{fontSize:7,padding:"1px 3px",marginTop:1,background:e.type==="medical"?"rgba(122,48,48,.12)":"rgba(60,79,61,.1)",color:e.type==="medical"?"#7a3030":"#3c4f3d",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.type==="medical"?"🏥":"🌱"}</div>)}
            </div>;
          })}
        </div>
        <div style={{display:"flex",gap:12,padding:"10px 20px",fontSize:10,color:"var(--t2)",flexWrap:"wrap"}}>
          <span style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:8,height:8,background:"#3c4f3d"}}/> Upcoming visit</span>
          <span style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:8,height:8,background:"rgba(122,48,48,.12)",border:"1px solid rgba(122,48,48,.3)"}}/> Past visit</span>
          <span style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:8,height:8,background:"rgba(60,79,61,.06)",border:"1px solid rgba(60,79,61,.2)"}}/> Today</span>
        </div>
      </div>

      {/* Upcoming visits list */}
      <div className="card"><div className="card-h"><h3>Upcoming visits</h3></div>
        {clScheds.filter(s=>s.date>=toISO(now())).slice(0,8).map(s=>{const cg=caregivers.find(c=>c.id===s.caregiverId);const hrs=((timeToMin(s.endTime)-timeToMin(s.startTime))/60).toFixed(1);return <div key={s.id} style={{padding:"12px 20px",borderBottom:"var(--border-thin)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:600,fontSize:14}}>{fromISO(s.date).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div><div style={{fontSize:12,color:"var(--t2)",marginTop:2}}>{s.startTime} — {s.endTime} ({hrs}h) | {cg?.name}</div></div>
          <span className="tag tag-ok">Confirmed</span>
        </div>;})}
        {clScheds.filter(s=>s.date>=toISO(now())).length===0&&<div className="empty">No upcoming visits</div>}
      </div>
    </div>}

    {/* ═══ CARE NOTES ═══ */}
    {tab==="notes"&& <div>
      <div className="card">{clNotes.slice(0,15).map(n=>{const cg=caregivers.find(c=>c.id===n.caregiverId);return <div key={n.id} style={{padding:"14px 20px",borderBottom:"var(--border-thin)"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t2)",marginBottom:6}}><div style={{display:"flex",gap:6,alignItems:"center"}}><span className={`tag ${NOTE_CATS[n.category]?.color||"tag-ok"}`}>{n.category}</span><span style={{fontWeight:600}}>{cg?.name}</span></div><span>{fmtD(n.date)} {fmtT(n.date)}</span></div>
        <div style={{fontSize:13,lineHeight:1.7}}>{n.text}</div>
        {n.photos&&n.photos.length>0&&<div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>{n.photos.map(ph=><a key={ph.id} href={ph.url} target="_blank" rel="noopener noreferrer"><img src={ph.url} alt="Task" style={{width:80,height:80,objectFit:"cover",border:"var(--border-thin)",cursor:"pointer"}}/></a>)}</div>}
      </div>;})}
      {clNotes.length===0&&<div className="empty">No care notes yet</div>}
      </div>

      {/* Incidents */}
      {clInc.length>0&& <div className="card" style={{marginTop:14}}>
        <div className="card-h"><h3>Incident reports</h3></div>
        {clInc.map(inc=> <div key={inc.id} style={{padding:"12px 20px",borderBottom:"var(--border-thin)"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span className={`tag ${inc.severity==="low"?"tag-wn":"tag-er"}`}>{inc.type} — {inc.severity}</span><span style={{fontSize:11,color:"var(--t2)"}}>{fmtD(inc.date)}</span></div>
          <div style={{fontSize:13,lineHeight:1.6}}>{inc.description}</div>
          {inc.followUp&&<div style={{fontSize:12,color:"var(--t2)",marginTop:6,padding:"6px 10px",background:"var(--bg)"}}><strong>Follow-up:</strong> {inc.followUp}</div>}
        </div>)}
      </div>}
    </div>}

    {/* ═══ MEDICATIONS ═══ */}
    {tab==="meds"&& <div>
      <div className="card"><div className="card-h"><h3>Current medications ({cl.meds?.length||0})</h3></div>
        <div className="card-b">
          {(cl.meds||[]).map((m,i)=>{const med=typeof m==="string"?{name:m}:m;return <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 0",borderBottom:i<cl.meds.length-1?"var(--border-thin)":""}}>
            {med.photo?<img src={med.photo} alt="Pill" style={{width:40,height:40,objectFit:"cover",border:"var(--border-thin)"}}/>:<div style={{width:40,height:40,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>💊</div>}
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600}}>{med.name}</div>
              {med.dose&&<div style={{fontSize:11,color:"var(--t2)"}}>{med.dose}{med.frequency?" • "+med.frequency:""}{med.time?" • "+med.time:""}</div>}
              {med.reason&&<div style={{fontSize:11,color:"var(--t2)",fontStyle:"italic"}}>For: {med.reason}</div>}
            </div>
            <span className="tag tag-ok" style={{fontSize:9}}>Active</span>
          </div>;})}
          {(!cl.meds||cl.meds.length===0)&&<div className="empty">No medications on file</div>}
        </div>
      </div>

      {/* Recent vitals */}
      {clVitals.length>0&& <div className="card" style={{marginTop:14}}>
        <div className="card-h"><h3>Recent health observations</h3></div>
        <div className="tw"><table><thead><tr><th>Date</th><th>BP</th><th>Heart Rate</th><th>Temp</th><th>Glucose</th><th>Weight</th><th>Notes</th></tr></thead><tbody>
          {clVitals.slice(0,5).map(v=> <tr key={v.id}><td>{fmtD(v.date)}</td><td style={{fontWeight:600}}>{v.bp||"—"}</td><td>{v.hr||"—"}</td><td>{v.temp||"—"}°</td><td>{v.glucose||"—"}</td><td>{v.weight||"—"} lbs</td><td style={{fontSize:11,color:"var(--t2)"}}>{v.notes||""}</td></tr>)}
        </tbody></table></div>
      </div>}

      {/* Medication-related incidents */}
      {clInc.filter(i=>/(Medication|Med)/i.test(i.type)).length>0&& <div className="ai-card" style={{marginTop:14}}>
        <h4><span className="pulse" style={{background:"#8a7356"}}/>Medication alerts</h4>
        <p>{clInc.filter(i=>/(Medication|Med)/i.test(i.type)).map(i=>`${fmtD(i.date)}: ${i.description.slice(0,100)}`).join(" | ")}</p>
      </div>}
    </div>}

    {/* ═══ MESSAGES ═══ */}
    {tab==="messages"&& <div>
      <div className="card" style={{maxHeight:"65vh",display:"flex",flexDirection:"column"}}>
        <div className="card-h"><h3>Messages with care team</h3></div>
        <div style={{flex:1,overflow:"auto",padding:"14px 20px",display:"flex",flexDirection:"column",gap:6}}>
          {clMsgs.length===0&&<div className="empty" style={{padding:30}}>Start a conversation with the care team</div>}
          {clMsgs.map(m=> <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:m.from===user.name?"flex-end":"flex-start"}}>
            <div className="chat-meta">{m.from} | {fmtRel(m.date)}</div>
            <div className={`chat-bubble ${m.from===user.name?"chat-fam":"chat-cg"}`}>{m.text}</div>
          </div>)}
        </div>
        <div style={{padding:"10px 14px",borderTop:"var(--border-thin)",display:"flex",gap:8}}>
          <input value={msgText} onChange={e=>setMsgText(e.target.value)} placeholder="Message the care team..." style={{flex:1,padding:"10px 14px",border:"var(--border-thin)",fontSize:14,fontFamily:"var(--f)"}} onKeyDown={e=>e.key==="Enter"&&sendMsg()}/>
          <button className="btn btn-p" onClick={sendMsg} disabled={!msgText.trim()}>Send</button>
        </div>
      </div>
    </div>}

    {/* ═══ BILLING & REPORTS ═══ */}
    {tab==="billing"&& <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
        <div style={{background:"var(--card)",border:"var(--border-thin)",padding:16,textAlign:"center"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Total Billed</div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,marginTop:4}}>{$(clInv.reduce((s,i)=>s+i.total,0))}</div></div>
        <div style={{background:"var(--card)",border:"var(--border-thin)",padding:16,textAlign:"center"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Hours This Month</div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,marginTop:4}}>{clScheds.filter(s=>s.date?.startsWith(toISO(now()).slice(0,7))).reduce((s,sh)=>s+(timeToMin(sh.endTime)-timeToMin(sh.startTime))/60,0).toFixed(0)}h</div></div>
        <div style={{background:"var(--card)",border:"var(--border-thin)",padding:16,textAlign:"center"}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)"}}>Expenses</div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,marginTop:4}}>{$(clExp.reduce((s,e)=>s+e.amount,0))}</div></div>
      </div>

      {/* Invoices */}
      <div className="card"><div className="card-h"><h3>Invoices</h3></div>
        <div className="tw"><table><thead><tr><th>Invoice #</th><th>Period</th><th>Date</th><th style={{textAlign:"right"}}>Amount</th><th>Status</th></tr></thead><tbody>
          {clInv.map(inv=> <tr key={inv.id}><td style={{fontFamily:"monospace",fontWeight:700}}>{inv.id}</td><td style={{fontSize:11}}>{fmtD(inv.date)}</td><td>{fmtD(inv.dueDate)}</td><td style={{textAlign:"right",fontWeight:700}}>{$(inv.total)}</td><td><span className={`tag ${inv.status==="paid"?"tag-ok":"tag-wn"}`}>{inv.status}</span></td></tr>)}
        </tbody></table></div>
        {clInv.length===0&&<div className="empty">No invoices yet</div>}
      </div>

      {/* Approved expenses (shopping, mileage) */}
      {clExp.length>0&& <div className="card" style={{marginTop:14}}>
        <div className="card-h"><h3>Expense details (shopping, mileage, supplies)</h3></div>
        <div className="tw"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Caregiver</th><th style={{textAlign:"right"}}>Amount</th></tr></thead><tbody>
          {clExp.map(e=>{const cg=caregivers.find(c=>c.id===e.caregiverId);return <tr key={e.id}><td>{fmtD(e.date)}</td><td><span className="tag tag-bl">{e.category}</span></td><td>{e.description}</td><td>{cg?.name||"—"}</td><td style={{textAlign:"right",fontWeight:600}}>${e.amount.toFixed(2)}</td></tr>;})}
        </tbody></table></div>
      </div>}
    </div>}

    {/* ═══ CARE TEAM ═══ */}
    {tab==="team"&& <div>
      {assignedCGs.map(cg=> <div key={cg.id} className="card card-b" style={{display:"flex",gap:16,alignItems:"flex-start",marginBottom:12}}>
        <ProfileAvatar name={cg.name} photo={cg.photo} size={56} dark/>
        <div style={{flex:1}}>
          <div style={{fontFamily:"var(--fd)",fontSize:18,fontWeight:400}}>{cg.name}</div>
          <div style={{fontSize:12,color:"var(--t2)",marginTop:2}}>{cg.email} | {cg.phone}</div>
          <div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
            {(cg.certs||[]).map(c=> <span key={c} className="tag tag-bl">{c}</span>)}
          </div>
          <div style={{fontSize:11,color:"var(--t2)",marginTop:8}}>Hired: {fmtD(cg.hireDate)} | Rate: ${cg.rate}/hr</div>
        </div>
      </div>)}
      {assignedCGs.length===0&&<div className="card card-b empty">No caregivers assigned yet</div>}
    </div>}

    {/* ═══ NOTIFICATIONS / ALERTS ═══ */}
    {tab==="alerts"&& <div>
      <div className="ai-card"><h4><span className="pulse" style={{background:"#3c4f3d"}}/>Notification center</h4>
        <p>You receive alerts when caregivers clock in/out, when they're running late, for schedule changes, emergencies, and incident reports. In production, these will also be sent as text/call alerts.</p>
      </div>

      {clNotifs.length===0&&<div className="card card-b empty">No notifications yet. You'll receive alerts for caregiver arrivals, departures, late notifications, and schedule changes.</div>}
      {clNotifs.map(n=> <div key={n.id} style={{padding:"14px 20px",borderBottom:"var(--border-thin)",background:n.read?"var(--card)":"rgba(138,115,86,.04)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {!n.read&&<div style={{width:6,height:6,borderRadius:"50%",background:"#8a7356"}}/>}
            <span style={{fontSize:13,fontWeight:600}}>{n.title}</span>
            <span className={`tag ${n.type==="running_late"?"tag-wn":n.type==="incident"?"tag-er":"tag-ok"}`} style={{fontSize:8}}>{n.type.replace(/_/g," ")}</span>
          </div>
          <span style={{fontSize:10,color:"var(--t2)"}}>{fmtRel(n.date)}</span>
        </div>
        <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.6}}>{n.body}</div>
      </div>)}

      {/* Text/Call Alert Info */}
      <div style={{padding:16,background:"var(--bg)",marginTop:16,border:"var(--border-thin)"}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:"var(--t2)",marginBottom:8}}>📱 Automatic text/call alerts</div>
        <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.7}}>
          In production, the following events will trigger automatic SMS/call notifications to your registered phone number:
        </div>
        <div style={{marginTop:8,display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {["Caregiver running late → Text with ETA","Caregiver arrived → Text confirmation","Emergency incident → Phone call + text","Missed visit → Text + call to office","Schedule change → Text notification","Caregiver departure → Text with visit summary"].map((item,i)=> <div key={i} style={{padding:"8px 12px",background:"var(--card)",border:"var(--border-thin)",fontSize:11}}>✓ {item}</div>)}
        </div>
      </div>
    </div>}

    {/* ═══ REFER ═══ */}
    {tab==="refer"&& <ReferralForm referrerName={user.name} referrerRole={"Family Member — "+cl.name} onReferCG={onReferCG} onReferClient={onReferClient}/>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// USER MANAGEMENT (Owner/Admin only)
// ═══════════════════════════════════════════════════════════════════════
function UserManagementPage({allUsers,setAllUsers}){
  const [showAdd,setShowAdd]=useState(false);
  const [editUser,setEditUser]=useState(null);
  const [f,sF]=useState({email:"",pin:"",name:"",role:"caregiver",phone:"",title:"",active:true});

  const save=()=>{
    if(!f.email||!f.name||!f.pin)return;
    if(editUser){
      setAllUsers(p=>p.map(u=>u.id===editUser.id?{...editUser,...f,avatar:f.name.split(" ").map(n=>n[0]).join("").slice(0,2)}:u));
    } else {
      setAllUsers(p=>[...p,{id:"U"+uid(),...f,avatar:f.name.split(" ").map(n=>n[0]).join("").slice(0,2)}]);
    }
    sF({email:"",pin:"",name:"",role:"caregiver",phone:"",title:"",active:true});
    setShowAdd(false);setEditUser(null);
  };

  const deactivate=(id)=>setAllUsers(p=>p.map(u=>u.id===id?{...u,active:!u.active}:u));
  const byRole=(r)=>allUsers.filter(u=>u.role===r);

  return <div>
    <div className="hdr"><div><h2>User Management</h2><div className="hdr-sub">{allUsers.length} accounts | {allUsers.filter(u=>u.active).length} active</div></div>
      <button className="btn btn-p btn-sm" onClick={()=>{setShowAdd(true);setEditUser(null);sF({email:"",pin:"",name:"",role:"caregiver",phone:"",title:"",active:true});}}>+ Add User</button>
    </div>

    <div className="sg">
      {Object.entries(ROLES).map(([key,r])=> <div key={key} className="sc"><span className="sl">{r.label}s</span><span className="sv">{byRole(key).length}</span><span className="ss">{byRole(key).filter(u=>u.active).length} active</span></div>)}
    </div>

    {(showAdd||editUser)&& <div className="card card-b" style={{borderLeft:"3px solid var(--black)"}}>
      <h3 style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:400,marginBottom:14}}>{editUser?"Edit User":"Add New User"}</h3>
      <div className="fg" style={{marginBottom:12}}>
        <div className="fi"><label>Full Name</label><input value={f.name} onChange={e=>sF({...f,name:e.target.value})} placeholder="Jane Smith"/></div>
        <div className="fi"><label>Email</label><input type="email" value={f.email} onChange={e=>sF({...f,email:e.target.value})} placeholder="jane@cwinathome.com"/></div>
        <div className="fi"><label>PIN (4 digits)</label><input type="password" maxLength={4} value={f.pin} onChange={e=>sF({...f,pin:e.target.value})} placeholder="••••"/></div>
        <div className="fi"><label>Role</label><select value={f.role} onChange={e=>sF({...f,role:e.target.value})}>{Object.entries(ROLES).map(([k,r])=> <option key={k} value={k}>{r.label}</option>)}</select></div>
        <div className="fi"><label>Phone</label><input value={f.phone} onChange={e=>sF({...f,phone:e.target.value})}/></div>
        <div className="fi"><label>Title</label><input value={f.title} onChange={e=>sF({...f,title:e.target.value})} placeholder="CNA, Office Admin, etc."/></div>
      </div>
      <div style={{display:"flex",gap:8}}><button className="btn btn-p" onClick={save}>Save</button><button className="btn btn-s" onClick={()=>{setShowAdd(false);setEditUser(null);}}>Cancel</button></div>
    </div>}

    <div className="card"><div className="card-h"><h3>All Users</h3></div>
      <div className="tw"><table><thead><tr><th></th><th>Name</th><th>Email</th><th>Role</th><th>Title</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {allUsers.map(u=> <tr key={u.id} style={{opacity:u.active?1:.45}}>
          <td><div className="avatar" style={{width:32,height:32,fontSize:10,background:ROLES[u.role]?.color||"#111",color:"#fff"}}>{u.avatar}</div></td>
          <td style={{fontWeight:600}}>{u.name}</td>
          <td style={{fontSize:11}}>{u.email}</td>
          <td><span className="tag tag-bl">{ROLES[u.role]?.label}</span></td>
          <td style={{fontSize:12,color:"var(--t2)"}}>{u.title}</td>
          <td style={{fontSize:12}}>{u.phone}</td>
          <td>{u.active? <span className="tag tag-ok">Active</span>:<span className="tag tag-er">Inactive</span>}</td>
          <td><div style={{display:"flex",gap:4}}>
            <button className="btn btn-sm btn-s" onClick={()=>{setEditUser(u);sF({email:u.email,pin:u.pin,name:u.name,role:u.role,phone:u.phone,title:u.title,active:u.active});setShowAdd(true);}}>Edit</button>
            <button className="btn btn-sm btn-s" onClick={()=>deactivate(u.id)}>{u.active?"Deactivate":"Activate"}</button>
          </div></td>
        </tr>)}
      </tbody></table></div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════
export default function App(){
  const [user,setUser]=useState(null);
  const [allUsers,setAllUsers]=useState(USERS);
  const [pg,setPg]=useState("dash");
  const [clients,setClients]=useState(CLIENTS);
  const [caregivers,setCaregivers]=useState(CAREGIVERS);
  const [chores,setChores]=useState(seedChores);
  const [incidents,setIncidents]=useState(seedIncidents);
  const [careNotes,setCareNotes]=useState(seedCareNotes);
  const [expenses,setExpenses]=useState(seedExpenses);
  const [events,setEvents]=useState(seedEvents);
  const [familyMsgs,setFamilyMsgs]=useState(seedFamilyMessages);
  const [trainingProgress,setTrainingProgress]=useState({"CG1":[0,1,2,3,4,5,6,7],"CG2":[0,1,2,3,8],"CG3":[0,1,2,3,4,5,6,7,8,10],"CG4":[0,1,2,3,4,5,9]});
  const [modal,setModal]=useState(null);
  const [selClient,setSelClient]=useState("CL1");
  const [selCG,setSelCG]=useState("");
  const [serviceRequests,setServiceRequests]=useState(seedServiceRequests);
  const [surveys,setSurveys]=useState(seedSurveys);
  const [careGoals,setCareGoals]=useState(seedCareGoals);
  const [vitals,setVitals]=useState(seedVitals);
  const [documents]=useState(seedDocuments);
  const [portalClient,setPortalClient]=useState("CL1");
  const [cgApplicants,setCGApplicants]=useState(seedCGApplicants);
  const [clientLeads,setClientLeads]=useState(seedClientLeads);
  const [compliance,setCompliance]=useState(seedComplianceItems);
  const [campaigns,setCampaigns]=useState(seedCampaigns);
  const [reconEntries]=useState(seedReconEntries);
  const [schedules,setSchedules]=useState(seedSchedules);
  const [assignments,setAssignments]=useState(seedAssignments);
  const [rateCards,setRateCards]=useState(seedRateCards);
  const [payCards,setPayCards]=useState(seedPayCards);
  const [billingPeriods,setBillingPeriods]=useState(seedBillingPeriods);
  const [invoices,setInvoices]=useState(seedInvoices);
  const [paySlips,setPaySlips]=useState(seedPaySlips);
  const [notifications,setNotifications]=useState([]);
  // Feature flags: per-entity toggle map
  // featureFlags = {clientId: {featureId: bool}, caregiverId: {featureId: bool}, global: {featureId: bool}}
  const [featureFlags,setFeatureFlags]=useState(()=>{
    const init={global:{}};
    FEATURES.forEach(f=>init.global[f.id]=f.default);
    return init;
  });
  // Helper: check if feature enabled for entity
  const isFeatureEnabled=(featureId,entityId)=>{
    if(entityId&&featureFlags[entityId]&&featureFlags[entityId][featureId]!==undefined)return featureFlags[entityId][featureId];
    return featureFlags.global?.[featureId]??FEATURES.find(f=>f.id===featureId)?.default??false;
  };
  const toggleFeature=(featureId,entityId)=>{
    setFeatureFlags(prev=>{
      const next={...prev};
      if(entityId){
        if(!next[entityId])next[entityId]={};
        else next[entityId]={...next[entityId]};
        next[entityId][featureId]=!isFeatureEnabled(featureId,entityId);
      }else{
        next.global={...next.global,[featureId]:!isFeatureEnabled(featureId)};
      }
      return next;
    });
  };
  // Audit log
  const [auditLog,setAuditLog]=useState([]);
  const logAction=(action,entity,detail)=>{setAuditLog(p=>[{id:"AL"+uid(),date:now().toISOString(),action,entity,detail,user:user?.name||"system"},...p].slice(0,500));};
  // Live GPS positions of caregivers
  const [livePositions,setLivePositions]=useState({});
  // Shift swap requests
  const [swapRequests,setSwapRequests]=useState([]);
  // Supply inventory
  const [supplies,setSupplies]=useState([
    {id:"SP1",clientId:"CL1",item:"Gloves (medium)",qty:50,reorderAt:20,lastOrdered:"2026-02-15"},
    {id:"SP2",clientId:"CL1",item:"Adult wipes",qty:8,reorderAt:5,lastOrdered:"2026-02-20"},
    {id:"SP3",clientId:"CL2",item:"Gloves (large)",qty:15,reorderAt:20,lastOrdered:"2026-02-10"},
    {id:"SP4",clientId:"CL2",item:"Diabetic test strips",qty:30,reorderAt:25,lastOrdered:"2026-03-01"},
    {id:"SP5",clientId:"CL3",item:"Levodopa pills",qty:14,reorderAt:14,lastOrdered:"2026-02-28"},
  ]);
  const [incidentPrompts,setIncidentPrompts]=useState(DEFAULT_INCIDENT_PROMPTS);

  // Load photos from Supabase Storage on startup
  useEffect(()=>{
    const loadPhotos=async()=>{
      // Check each client for saved photo
      for(const cl of CLIENTS){
        const url=SB_URL+"/storage/v1/object/public/avatars/client/"+cl.id+".jpeg";
        try{
          const resp=await fetch(url,{method:"HEAD"});
          if(resp.ok)setClients(p=>p.map(c=>c.id===cl.id?{...c,photo:url+"?t="+Date.now()}:c));
        }catch(e){}
      }
      // Check each caregiver for saved photo
      for(const cg of CAREGIVERS){
        const url=SB_URL+"/storage/v1/object/public/avatars/caregiver/"+cg.id+".jpeg";
        try{
          const resp=await fetch(url,{method:"HEAD"});
          if(resp.ok)setCaregivers(p=>p.map(c=>c.id===cg.id?{...c,photo:url+"?t="+Date.now()}:c));
        }catch(e){}
      }
    };
    loadPhotos();
  },[]);
  const notify=(to,type,title,body,meta={})=>{
    const n={id:"NT"+uid(),to,type,title,body,meta,date:now().toISOString(),read:false};
    setNotifications(p=>[n,...p]);return n;
  };
  // Helper: get assigned clients for a caregiver
  const getAssignedClients=(cgId)=>{const ids=assignments.filter(a=>a.caregiverId===cgId&&a.status==="active").map(a=>a.clientId);return clients.filter(c=>ids.includes(c.id));};
  // Helper: get assigned caregivers for a client
  const getAssignedCGs=(clId)=>{const ids=assignments.filter(a=>a.clientId===clId&&a.status==="active").map(a=>a.caregiverId);return caregivers.filter(c=>ids.includes(c.id));};

  const openInc=incidents.filter(i=>i.status==="open").length;
  const pendExp=expenses.filter(e=>e.status==="pending").length;
  const cl=clients.find(c=>c.id===selClient)||clients[0];

  const overdue=compliance.filter(c=>c.status==="overdue").length;
  const expSoon=compliance.filter(c=>c.status==="expiring_soon").length;
  const flaggedRecon=reconEntries.filter(r=>r.status==="flagged"||r.status==="review").length;
  const newApps=cgApplicants.filter(a=>a.status==="new").length+clientLeads.filter(l=>l.status==="new"||l.status==="inquiry").length;

  const draftScheds=schedules.filter(s=>s.status==="draft").length;

  const nav=[
    {sec:"Overview"},{key:"dash",label:"Command Center",ico:"⚡"},
    {sec:"Operations"},{key:"schedule",label:"Scheduling",ico:"📅",badge:draftScheds||null},{key:"clients",label:"Client Profiles",ico:"👤"},{key:"care",label:"Care Management",ico:"📋",badge:openInc||null},{key:"recon",label:"Reconciliation",ico:"🔍",badge:flaggedRecon||null},{key:"expenses",label:"Expenses",ico:"💰",badge:pendExp||null},{key:"gps_map",label:"Live GPS Map",ico:"📍"},{key:"shift_swap",label:"Shift Swaps",ico:"🔄",badge:swapRequests.filter(s=>s.status==="open").length||null},{key:"supplies",label:"Supply Tracking",ico:"📦",badge:supplies.filter(s=>s.qty<=s.reorderAt).length||null},
    {sec:"Finance"},{key:"billing",label:"Billing & Invoices",ico:"🧾"},{key:"payroll",label:"Payroll & Pay Slips",ico:"💵"},{key:"rates",label:"Rate Cards",ico:"💲"},
    {sec:"Growth"},{key:"training",label:"Training Academy",ico:"🎓"},{key:"recruiting",label:"Recruiting",ico:"📢",badge:newApps||null},{key:"marketing",label:"Marketing",ico:"📈"},{key:"events",label:"Events & Wellness",ico:"🌱"},
    {sec:"Compliance"},{key:"compliance",label:"Compliance Center",ico:"🛡️",badge:overdue||null},{key:"audit",label:"Audit Log",ico:"📜"},
    {sec:"AI"},{key:"ai_hub",label:"AI Command",ico:"🤖"},
    {sec:"Connections"},{key:"portal",label:"Client Portal",ico:"🏠"},{key:"family",label:"Family Portal",ico:"👨‍👩‍👧"},{key:"team",label:"Team",ico:"👥"},
    {sec:"Admin"},{key:"features",label:"Feature Management",ico:"⚙️"},{key:"notifications",label:"Notifications",ico:"🔔",badge:notifications.filter(n=>!n.read).length||null},{key:"incident_settings",label:"AI Incident Settings",ico:"🤖"},{key:"users",label:"User Management",ico:"🔐"},
  ];

  // Role-based nav filtering
  const userPerms=user?PERMS[user.role]:[];
  const filteredNav=nav.filter(n=>{
    if(n.sec)return true;
    return userPerms.includes(n.key);
  });
  // Remove empty sections (section with no items after it)
  const cleanNav=filteredNav.filter((n,i,arr)=>{
    if(!n.sec)return true;
    const nextItem=arr[i+1];
    return nextItem&&!nextItem.sec;
  });

  const logout=()=>{setUser(null);setPg("dash");};

  // ── LOGIN GATE ──
  if(!user) return <><style>{CSS}</style><LoginScreen onLogin={(u)=>{
    setUser(u);
    if(u.role==="caregiver")setPg("cg_home");
    else if(u.role==="client")setPg("cl_home");
    else if(u.role==="family")setPg("fm_home");
    else setPg("dash");
  }}/></>;

  // ── CAREGIVER PORTAL ──
  if(user.role==="caregiver") return <><style>{CSS}</style><div className="app">
    <div className="sb">
      <div className="sb-logo"><Logo s={56} c="#fff"/></div>
      <nav style={{flex:1,paddingTop:4}}/>
      <div className="user-bar" onClick={logout}>
        <div className="avatar" style={{width:30,height:30,fontSize:10,background:"rgba(255,255,255,.1)",color:"#fff"}}>{user.avatar}</div>
        <div><div className="ub-name">{user.name}</div><div className="ub-role">{ROLES[user.role]?.label}</div></div>
      </div>
    </div>
    <div className="main">
      <CaregiverPortal user={user} clients={clients} caregivers={caregivers} careNotes={careNotes} setCareNotes={setCareNotes} incidents={incidents} setIncidents={setIncidents} expenses={expenses} setExpenses={setExpenses} events={events} chores={chores} schedules={schedules} trainingProgress={trainingProgress} setTrainingProgress={setTrainingProgress} familyMsgs={familyMsgs} setFamilyMsgs={setFamilyMsgs} modal={modal} setModal={setModal} notify={notify} assignments={assignments} incidentPrompts={incidentPrompts} getAssignedClients={getAssignedClients} allUsers={allUsers} onReferCG={ap=>setCGApplicants(p=>[ap,...p])} onReferClient={ld=>setClientLeads(p=>[ld,...p])}/>
    </div>
  </div></>;

  // ── CLIENT PORTAL ──
  if(user.role==="client") return <><style>{CSS}</style><div className="app">
    <div className="sb">
      <div className="sb-logo"><Logo s={56} c="#fff"/></div>
      <nav style={{flex:1,paddingTop:4}}/>
      <div className="user-bar" onClick={logout}>
        <div className="avatar" style={{width:30,height:30,fontSize:10,background:"rgba(255,255,255,.1)",color:"#fff"}}>{user.avatar}</div>
        <div><div className="ub-name">{user.name}</div><div className="ub-role">{ROLES[user.role]?.label}</div></div>
      </div>
    </div>
    <div className="main">
      <ClientPortalPage clients={clients} caregivers={caregivers} notify={notify} assignments={assignments} sel={user.clientId||"CL1"} setSel={()=>{}} serviceRequests={serviceRequests} setServiceRequests={setServiceRequests} surveys={surveys} setSurveys={setSurveys} careGoals={careGoals} vitals={vitals} setVitals={setVitals} documents={documents} careNotes={careNotes} events={events} expenses={expenses} familyMsgs={familyMsgs} setFamilyMsgs={setFamilyMsgs} notifications={notifications} onReferCG={ap=>setCGApplicants(p=>[ap,...p])} onReferClient={ld=>setClientLeads(p=>[ld,...p])}/>
    </div>
  </div></>;

  // ── FAMILY PORTAL ──
  if(user.role==="family") return <><style>{CSS}</style><div className="app">
    <div className="sb">
      <div className="sb-logo"><Logo s={56} c="#fff"/></div>
      <nav style={{flex:1,paddingTop:4}}/>
      <div className="user-bar" onClick={logout}>
        <div className="avatar" style={{width:30,height:30,fontSize:10,background:"rgba(255,255,255,.1)",color:"#fff"}}>{user.avatar}</div>
        <div><div className="ub-name">{user.name}</div><div className="ub-role">{ROLES[user.role]?.label}</div></div>
      </div>
    </div>
    <div className="main">
      <FamilyStandalonePortal user={user} clients={clients} caregivers={caregivers} careNotes={careNotes} events={events} familyMsgs={familyMsgs} setFamilyMsgs={setFamilyMsgs} incidents={incidents} schedules={schedules} expenses={expenses} vitals={vitals} invoices={invoices} assignments={assignments} notifications={notifications} notify={notify} onReferCG={ap=>setCGApplicants(p=>[ap,...p])} onReferClient={ld=>setClientLeads(p=>[ld,...p])}/>
    </div>
  </div></>;

  // ── ADMIN / OWNER / MANAGER ──
  return <><style>{CSS}</style><div className="app">
    <div className="sb">
      <div className="sb-logo"><Logo s={56} c="#fff"/></div>
      <nav style={{flex:1,paddingTop:4}}>
        {cleanNav.map((n,i)=>n.sec?<div key={i} className="sb-sec">{n.sec}</div>
          :<div key={n.key} className={`ni ${pg===n.key?"act":""}`} onClick={()=>setPg(n.key)}>
            <span className="ico">{n.ico}</span><span>{n.label}</span>
            {n.badge&&<span className="badge">{n.badge}</span>}
          </div>)}
      </nav>
      <div className="user-bar" onClick={logout}>
        <div className="avatar" style={{width:30,height:30,fontSize:10,background:"rgba(255,255,255,.1)",color:"#fff"}}>{user.avatar}</div>
        <div><div className="ub-name">{user.name}</div><div className="ub-role">{ROLES[user.role]?.label} | Sign Out</div></div>
      </div>
    </div>

    <div className="main">
      {pg==="dash"&&<DashPage clients={clients} caregivers={caregivers} incidents={incidents} expenses={expenses} careNotes={careNotes} events={events} trainingProgress={trainingProgress} schedules={schedules} setPg={setPg}/>}
      {pg==="schedule"&&<SchedulePage schedules={schedules} setSchedules={setSchedules} clients={clients} caregivers={caregivers}/>}
      {pg==="clients"&&<ClientsPage clients={clients} setClients={setClients} sel={selClient} setSel={setSelClient} caregivers={caregivers} careNotes={careNotes} incidents={incidents} events={events} chores={chores} expenses={expenses} schedules={schedules}/>}
      {pg==="care"&&<CarePage clients={clients} caregivers={caregivers} chores={chores} setChores={setChores} incidents={incidents} setIncidents={setIncidents} careNotes={careNotes} setCareNotes={setCareNotes} modal={modal} setModal={setModal}/>}
      {pg==="expenses"&&<ExpensesPage expenses={expenses} setExpenses={setExpenses} caregivers={caregivers} clients={clients}/>}
      {pg==="recon"&&<ReconPage entries={reconEntries} caregivers={caregivers} clients={clients}/>}
      {pg==="billing"&&<BillingPage invoices={invoices} setInvoices={setInvoices} clients={clients} caregivers={caregivers} rateCards={rateCards} billingPeriods={billingPeriods} setBillingPeriods={setBillingPeriods} schedules={schedules} expenses={expenses}/>}
      {pg==="payroll"&&<PayrollPage paySlips={paySlips} setPaySlips={setPaySlips} caregivers={caregivers} clients={clients} payCards={payCards} billingPeriods={billingPeriods} schedules={schedules} expenses={expenses} rateCards={rateCards}/>}
      {pg==="rates"&&<RateCardsPage rateCards={rateCards} setRateCards={setRateCards} payCards={payCards} setPayCards={setPayCards} clients={clients} caregivers={caregivers}/>}
      {pg==="recruiting"&&<RecruitingPage applicants={cgApplicants} setApplicants={setCGApplicants} leads={clientLeads} setLeads={setClientLeads} clients={clients} setClients={setClients} caregivers={caregivers} setCaregivers={setCaregivers} setSel={setSelClient} setPg={setPg}/>}
      {pg==="marketing"&&<MarketingPage campaigns={campaigns} setCampaigns={setCampaigns} leads={clientLeads} applicants={cgApplicants}/>}
      {pg==="compliance"&&<CompliancePage items={compliance} setItems={setCompliance} caregivers={caregivers} clients={clients}/>}
      {pg==="training"&&<TrainingPage caregivers={caregivers} progress={trainingProgress} setProgress={setTrainingProgress} modal={modal} setModal={setModal}/>}
      {pg==="events"&&<EventsPage events={events} setEvents={setEvents} clients={clients}/>}
      {pg==="portal"&&<ClientPortalPage clients={clients} caregivers={caregivers} notify={notify} assignments={assignments} sel={portalClient} setSel={setPortalClient} serviceRequests={serviceRequests} setServiceRequests={setServiceRequests} surveys={surveys} setSurveys={setSurveys} careGoals={careGoals} vitals={vitals} setVitals={setVitals} documents={documents} careNotes={careNotes} events={events} expenses={expenses} familyMsgs={familyMsgs} setFamilyMsgs={setFamilyMsgs} notifications={notifications} onReferCG={ap=>setCGApplicants(p=>[ap,...p])} onReferClient={ld=>setClientLeads(p=>[ld,...p])}/>}
      {pg==="family"&&<FamilyPage clients={clients} familyMsgs={familyMsgs} setFamilyMsgs={setFamilyMsgs} careNotes={careNotes} incidents={incidents} events={events}/>}
      {pg==="team"&&<TeamPage caregivers={caregivers} setCaregivers={setCaregivers} progress={trainingProgress} clients={clients} assignments={assignments} setAssignments={setAssignments}/>}
      {pg==="users"&&<UserManagementPage allUsers={allUsers} setAllUsers={setAllUsers}/>}
      {pg==="features"&&<FeatureManagementPage featureFlags={featureFlags} setFeatureFlags={setFeatureFlags} isFeatureEnabled={isFeatureEnabled} toggleFeature={toggleFeature} clients={clients} caregivers={caregivers} logAction={logAction}/>}
      {pg==="gps_map"&&<LiveGPSMapPage caregivers={caregivers} clients={clients} schedules={schedules} livePositions={livePositions}/>}
      {pg==="shift_swap"&&<ShiftSwapPage swapRequests={swapRequests} setSwapRequests={setSwapRequests} caregivers={caregivers} clients={clients} schedules={schedules} setSchedules={setSchedules} notify={notify}/>}
      {pg==="supplies"&&<SupplyPage supplies={supplies} setSupplies={setSupplies} clients={clients}/>}
      {pg==="audit"&&<AuditLogPage auditLog={auditLog} clients={clients} caregivers={caregivers} allUsers={allUsers}/>}
      {pg==="notifications"&&<NotificationsPage notifications={notifications} setNotifications={setNotifications} allUsers={allUsers} clients={clients} caregivers={caregivers} incidents={incidents} setIncidents={setIncidents} expenses={expenses} setExpenses={setExpenses}/>}
      {pg==="incident_settings"&&<IncidentSettingsPage prompts={incidentPrompts} setPrompts={setIncidentPrompts}/>}
      {pg==="ai_hub"&&<AIHub clients={clients} caregivers={caregivers} careNotes={careNotes} incidents={incidents} expenses={expenses} schedules={schedules} rateCards={rateCards} payCards={payCards} trainingProgress={trainingProgress} events={events} familyMsgs={familyMsgs} vitals={vitals} assignments={assignments} invoices={invoices} paySlips={paySlips} billingPeriods={billingPeriods} compliance={compliance} cgApplicants={cgApplicants} clientLeads={clientLeads}/>}
    </div>
  </div></>;
}

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// SCHEDULE PAGE — Admin/Owner/Manager
// ═══════════════════════════════════════════════════════════════════════
function SchedulePage({schedules,setSchedules,clients,caregivers}){
  const [weekStart,setWeekStart]=useState(getMonday(now()));
  const [selDay,setSelDay]=useState(toISO(now()));
  const [editShift,setEditShift]=useState(null);
  const [showCreate,setShowCreate]=useState(false);
  const [filterCG,setFilterCG]=useState("");
  const [showCopy,setShowCopy]=useState(false);
  const [showPublish,setShowPublish]=useState(false);

  const weekDates=Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const weekEnd=addDays(weekStart,6);
  const weekScheds=schedules.filter(s=>s.date>=toISO(weekStart)&&s.date<=toISO(weekEnd));
  const dayScheds=schedules.filter(s=>s.date===selDay&&(!filterCG||s.caregiverId===filterCG));
  const drafts=weekScheds.filter(s=>s.status==="draft");
  const weekHrs=weekScheds.reduce((s,sh)=>s+(timeToMin(sh.endTime)-timeToMin(sh.startTime))/60,0);

  // Conflict detection
  const conflicts=dayScheds.filter((s,i)=>dayScheds.some((s2,j)=>i!==j&&s.caregiverId===s2.caregiverId&&timeToMin(s.startTime)<timeToMin(s2.endTime)&&timeToMin(s2.startTime)<timeToMin(s.endTime)));

  const publishDay=()=>setSchedules(p=>p.map(s=>s.date===selDay&&s.status==="draft"?{...s,status:"published"}:s));
  const publishWeek=()=>{setSchedules(p=>p.map(s=>s.date>=toISO(weekStart)&&s.date<=toISO(weekEnd)&&s.status==="draft"?{...s,status:"published"}:s));setShowPublish(false);};
  const deleteShift=id=>setSchedules(p=>p.filter(s=>s.id!==id));
  const duplicateShift=sh=>setSchedules(p=>[...p,{...sh,id:"SC"+uid(),status:"draft"}]);
  const goToday=()=>{setWeekStart(getMonday(now()));setSelDay(toISO(now()));};

  const copyWeekTo=targetMon=>{
    const newShifts=weekScheds.map(s=>{const dayIdx=weekDates.findIndex(d=>toISO(d)===s.date);const nd=toISO(addDays(targetMon,dayIdx>=0?dayIdx:0));return{...s,id:"SC"+uid(),date:nd,status:"draft"};});
    setSchedules(p=>[...p,...newShifts]);setShowCopy(false);setWeekStart(targetMon);
  };

  const saveShift=data=>{
    if(data.id&&schedules.some(s=>s.id===data.id)) setSchedules(p=>p.map(s=>s.id===data.id?{...data}:s));
    else setSchedules(p=>[...p,{...data,id:"SC"+uid()}]);
    setEditShift(null);setShowCreate(false);
  };

  // ─── CREATE/EDIT FORM ───
  const ShiftForm=({initial,onSave,onClose})=>{
    const [f,sF]=useState(initial||{caregiverId:"CG1",clientId:"CL1",date:selDay,startTime:"08:00",endTime:"14:00",tasks:[],notes:"",status:"draft",color:"#3c4f3d"});
    const [taskInput,setTaskInput]=useState("");
    const [showPresets,setShowPresets]=useState(false);
    const hrs=(timeToMin(f.endTime)-timeToMin(f.startTime))/60;
    const addTask=()=>{if(taskInput.trim()){sF(p=>({...p,tasks:[...p.tasks,taskInput.trim()]}));setTaskInput("");}};
    const cgColors={"CG1":"#3c4f3d","CG2":"#4a3f5c","CG3":"#8a7356","CG4":"#3f4749"};

    return <div className="modal-bg" onClick={onClose}><div className="modal" style={{maxWidth:600}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">{initial?"Edit Shift":"Create Shift"}<button className="btn btn-sm btn-s" onClick={onClose}>✕</button></div>
      <div className="modal-b">
        <div className="fg" style={{marginBottom:14}}>
          <div className="fi"><label>Caregiver</label><select value={f.caregiverId} onChange={e=>sF(p=>({...p,caregiverId:e.target.value,color:cgColors[e.target.value]||"#3c4f3d"}))}>{caregivers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="fi"><label>Client</label><select value={f.clientId} onChange={e=>sF(p=>({...p,clientId:e.target.value}))}>{clients.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <div className="fg" style={{marginBottom:14}}>
          <div className="fi"><label>Date</label><input type="date" value={f.date} onChange={e=>sF(p=>({...p,date:e.target.value}))}/></div>
          <div className="fi"><label>Start</label><input type="time" value={f.startTime} onChange={e=>sF(p=>({...p,startTime:e.target.value}))}/></div>
          <div className="fi"><label>End</label><input type="time" value={f.endTime} onChange={e=>sF(p=>({...p,endTime:e.target.value}))}/></div>
        </div>
        {hrs>0&& <div style={{textAlign:"center",padding:6,background:"var(--bg)",marginBottom:14,fontSize:13,fontWeight:600}}>{hrs.toFixed(1)} hours</div>}

        <div className="fi" style={{marginBottom:14}}>
          <label style={{display:"flex",justifyContent:"space-between"}}><span>Tasks ({f.tasks.length})</span><span style={{cursor:"pointer",color:"#8a7356"}} onClick={()=>setShowPresets(!showPresets)}>+ Presets</span></label>
          {showPresets&& <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:8}}>
            {Object.entries(TASK_PRESETS).map(([k,v])=> <button key={k} className="btn btn-sm btn-s" onClick={()=>{sF(p=>({...p,tasks:[...p.tasks,...v]}));setShowPresets(false);}}>{k} ({v.length})</button>)}
          </div>}
          {f.tasks.map((t,i)=> <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"var(--border-thin)",fontSize:12}}>
            <span style={{flex:1}}>{t}</span><button style={{background:"none",border:"none",cursor:"pointer",color:"var(--err)",fontSize:14}} onClick={()=>sF(p=>({...p,tasks:p.tasks.filter((_,j)=>j!==i)}))}>✕</button>
          </div>)}
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <input value={taskInput} onChange={e=>setTaskInput(e.target.value)} placeholder="Add task..." style={{flex:1,padding:"8px 10px",border:"var(--border-thin)",fontSize:12}} onKeyDown={e=>e.key==="Enter"&&addTask()}/>
            <button className="btn btn-sm btn-p" onClick={addTask} disabled={!taskInput.trim()}>+</button>
          </div>
        </div>

        <div className="fi" style={{marginBottom:14}}><label>Notes</label><textarea rows={2} value={f.notes} onChange={e=>sF(p=>({...p,notes:e.target.value}))} placeholder="Special instructions..."/></div>

        <div className="fi" style={{marginBottom:14}}><label>Status</label>
          <div style={{display:"flex",gap:8}}>
            {["draft","published"].map(st=> <div key={st} onClick={()=>sF(p=>({...p,status:st}))} style={{flex:1,padding:10,border:`1.5px solid ${f.status===st?"var(--black)":"var(--bdr)"}`,background:f.status===st?"var(--black)":"var(--card)",color:f.status===st?"#fff":"var(--text)",textAlign:"center",fontSize:12,fontWeight:600,cursor:"pointer"}}>{st==="draft"?"📝 Draft":"✅ Published"}</div>)}
          </div>
        </div>

        <button className="btn btn-p" style={{width:"100%"}} onClick={()=>onSave(f)} disabled={hrs<=0}>Save Shift</button>
      </div>
    </div></div>;
  };

  return <div>
    <div className="hdr"><div><h2>Scheduling</h2><div className="hdr-sub">Create, manage, and publish shifts</div></div>
      <button className="btn btn-p btn-sm" onClick={()=>{setShowCreate(true);setEditShift(null);}}>+ Create Shift</button>
    </div>

    {/* Week Stats */}
    <div className="sg" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
      <div className="sc ok"><span className="sl">Shifts</span><span className="sv">{weekScheds.length}</span></div>
      <div className="sc bl"><span className="sl">Hours</span><span className="sv">{weekHrs.toFixed(0)}</span></div>
      <div className="sc" style={{position:"relative"}}><span className="sl" style={{color:drafts.length>0?"#8a7356":"var(--t2)"}}>Drafts</span><span className="sv" style={{color:drafts.length>0?"#8a7356":"inherit"}}>{drafts.length}</span>{drafts.length>0&& <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:"#8a7356"}}/>}</div>
      <div className="sc"><span className="sl">Staff</span><span className="sv">{new Set(weekScheds.map(s=>s.caregiverId)).size}</span></div>
    </div>

    {/* Publish Bar */}
    {drafts.length>0&& <div className="publish-bar">
      <div><div className="pb-text">{drafts.length} unpublished draft{drafts.length>1?"s":""}</div><div className="pb-sub">Caregivers can't see drafts</div></div>
      <button className="btn btn-sm" style={{background:"#fff",color:"#000",border:"none"}} onClick={()=>setShowPublish(true)}>Publish</button>
    </div>}

    {/* Week Nav */}
    <div className="week-nav">
      <button onClick={()=>setWeekStart(addDays(weekStart,-7))}>←</button>
      <div className="wn-center" onClick={goToday}><div className="wn-label">{fmtShort(weekStart)} — {fmtShort(weekEnd)}</div><div className="wn-sub">Tap for today</div></div>
      <button onClick={()=>setWeekStart(addDays(weekStart,7))}>→</button>
    </div>

    {/* Day Columns */}
    <div className="day-cols">
      {weekDates.map((d,i)=>{const iso=toISO(d);const daySch=schedules.filter(s=>s.date===iso);const hasDraft=daySch.some(s=>s.status==="draft");
        return <div key={i} className={`day-col ${iso===selDay?"sel":""} ${iso===toISO(now())?"is-today":""}`} onClick={()=>setSelDay(iso)}>
          <div className="dc-day">{DAYS[i]}</div>
          <div className="dc-num">{d.getDate()}</div>
          <div className="dc-dots">{daySch.slice(0,4).map((s,j)=> <div key={j} className="dc-dot" style={{background:iso===selDay?"rgba(255,255,255,.6)":s.status==="draft"?"#8a7356":(s.color||"#3c4f3d")}}/>)}</div>
        </div>;
      })}
    </div>

    {/* Filter & Actions */}
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <select value={filterCG} onChange={e=>setFilterCG(e.target.value)} style={{padding:"6px 10px",border:"var(--border-thin)",fontSize:11,fontFamily:"var(--f)",fontWeight:600}}>
        <option value="">All Caregivers</option>{caregivers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div style={{flex:1}}/>
      <button className="btn btn-sm btn-s" onClick={()=>setShowCopy(true)}>Copy Week</button>
      {dayScheds.some(s=>s.status==="draft")&& <button className="btn btn-sm btn-ok" onClick={publishDay}>Publish Day</button>}
    </div>

    {/* Conflicts */}
    {conflicts.length>0&& <div className="conflict-warn">⚠️ {conflicts.length} overlapping shift{conflicts.length>1?"s":""} detected for same caregiver</div>}

    {/* Day Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <div style={{fontWeight:600,fontSize:14}}>{fromISO(selDay).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}{selDay===toISO(now())&&<span style={{color:"#3c4f3d",marginLeft:6,fontSize:11}}>TODAY</span>}</div>
      <div style={{fontSize:12,color:"var(--t2)"}}>{dayScheds.length} shift{dayScheds.length!==1?"s":""}</div>
    </div>

    {/* Shift Blocks */}
    {dayScheds.length===0&& <div className="card card-b empty">No shifts. <button className="btn btn-sm btn-p" style={{marginTop:8}} onClick={()=>{setShowCreate(true);setEditShift(null);}}>+ Create</button></div>}
    {dayScheds.sort((a,b)=>a.startTime.localeCompare(b.startTime)).map(s=>{const cl=clients.find(c=>c.id===s.clientId);const cg=caregivers.find(c=>c.id===s.caregiverId);const hrs=((timeToMin(s.endTime)-timeToMin(s.startTime))/60).toFixed(1);const isDraft=s.status==="draft";const hasConflict=conflicts.some(c=>c.id===s.id);
      return <div key={s.id} className="shift-block" style={{background:isDraft?"rgba(138,115,86,.05)":"var(--card)",borderColor:hasConflict?"var(--err)":"var(--bdr)"}} onClick={()=>setEditShift(s)}>
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:isDraft?"#8a7356":(s.color||"#3c4f3d")}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{paddingLeft:10}}>
            <div style={{fontSize:14,fontWeight:600}}>{s.startTime} — {s.endTime} <span style={{fontWeight:400,color:"var(--t2)",fontSize:12}}>({hrs}h)</span></div>
            <div style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:400,marginTop:2}}>{cl?.name}</div>
            <div style={{fontSize:11,color:"var(--t2)",marginTop:2,display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:s.color||"#3c4f3d",display:"inline-block",flexShrink:0}}/>{cg?.name} | {s.tasks.length} tasks
            </div>
            {s.notes&& <div style={{fontSize:11,color:"#8a7356",marginTop:3}}>📝 {s.notes}</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <span className={`tag ${isDraft?"tag-wn":"tag-ok"}`}>{isDraft?"DRAFT":"PUBLISHED"}</span>
            {hasConflict&& <span className="tag tag-er">CONFLICT</span>}
          </div>
        </div>
      </div>;
    })}

    {dayScheds.length>0&& <div style={{marginTop:8}}><button className="btn btn-s" style={{width:"100%"}} onClick={()=>{setShowCreate(true);setEditShift(null);}}>+ Add shift on {fromISO(selDay).toLocaleDateString("en-US",{weekday:"long"})}</button></div>}

    {/* ── EDIT DETAIL MODAL ── */}
    {editShift&&!showCreate&& <div className="modal-bg" onClick={()=>setEditShift(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">Shift Detail<button className="btn btn-sm btn-s" onClick={()=>setEditShift(null)}>✕</button></div>
      <div className="modal-b">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <div style={{padding:12,background:"var(--bg)"}}><div style={{fontSize:9,color:"var(--t2)",textTransform:"uppercase",fontWeight:600}}>Client</div><div style={{fontWeight:700,fontSize:14}}>{clients.find(c=>c.id===editShift.clientId)?.name}</div></div>
          <div style={{padding:12,background:"var(--bg)"}}><div style={{fontSize:9,color:"var(--t2)",textTransform:"uppercase",fontWeight:600}}>Caregiver</div><div style={{fontWeight:700,fontSize:14}}>{caregivers.find(c=>c.id===editShift.caregiverId)?.name}</div></div>
          <div style={{padding:12,background:"var(--bg)"}}><div style={{fontSize:9,color:"var(--t2)",textTransform:"uppercase",fontWeight:600}}>Time</div><div style={{fontWeight:700,fontSize:14}}>{editShift.startTime} — {editShift.endTime}</div></div>
          <div style={{padding:12,background:"var(--bg)"}}><div style={{fontSize:9,color:"var(--t2)",textTransform:"uppercase",fontWeight:600}}>Status</div><span className={`tag ${editShift.status==="draft"?"tag-wn":"tag-ok"}`}>{editShift.status}</span></div>
        </div>
        {editShift.tasks.length>0&& <div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",color:"var(--t2)",letterSpacing:.5,marginBottom:6}}>Tasks</div>{editShift.tasks.map((t,i)=> <div key={i} style={{padding:"5px 0",borderBottom:"var(--border-thin)",fontSize:12}}>• {t}</div>)}</div>}
        {editShift.notes&& <div style={{padding:10,background:"rgba(138,115,86,.08)",fontSize:12,marginBottom:14}}>📝 {editShift.notes}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <button className="btn btn-p" onClick={()=>setShowCreate(true)}>Edit</button>
          <button className="btn btn-s" onClick={()=>{duplicateShift(editShift);setEditShift(null);}}>Duplicate</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {editShift.status==="draft"? <button className="btn btn-ok" onClick={()=>{setSchedules(p=>p.map(s=>s.id===editShift.id?{...s,status:"published"}:s));setEditShift(null);}}>Publish</button>
          : <button className="btn btn-s" onClick={()=>{setSchedules(p=>p.map(s=>s.id===editShift.id?{...s,status:"draft"}:s));setEditShift(null);}}>Unpublish</button>}
          <button className="btn btn-er" onClick={()=>{deleteShift(editShift.id);setEditShift(null);}}>Delete</button>
        </div>
      </div>
    </div></div>}

    {/* ── CREATE/EDIT FORM ── */}
    {showCreate&& <ShiftForm initial={editShift} onSave={saveShift} onClose={()=>{setShowCreate(false);setEditShift(null);}}/>}

    {/* ── PUBLISH WEEK MODAL ── */}
    {showPublish&& <div className="modal-bg" onClick={()=>setShowPublish(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">Publish Week<button className="btn btn-sm btn-s" onClick={()=>setShowPublish(false)}>✕</button></div>
      <div className="modal-b">
        <div style={{padding:14,background:"var(--bg)",marginBottom:14}}>
          <div style={{fontWeight:700,marginBottom:8}}>{fmtShort(weekStart)} — {fmtShort(weekEnd)}</div>
          <div style={{fontSize:12,color:"var(--t2)"}}>{weekScheds.length} total shifts | {drafts.length} drafts to publish | {weekScheds.length-drafts.length} already published</div>
        </div>
        <p style={{fontSize:12,color:"var(--t2)",marginBottom:14}}>Publishing makes all {drafts.length} draft{drafts.length>1?"s":""} visible to caregivers immediately.</p>
        <button className="btn btn-p" style={{width:"100%"}} onClick={publishWeek}>Publish {drafts.length} Shift{drafts.length>1?"s":""}</button>
      </div>
    </div></div>}

    {/* ── COPY WEEK MODAL ── */}
    {showCopy&& <div className="modal-bg" onClick={()=>setShowCopy(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">Copy Week<button className="btn btn-sm btn-s" onClick={()=>setShowCopy(false)}>✕</button></div>
      <div className="modal-b">
        <p style={{fontSize:12,color:"var(--t2)",marginBottom:14}}>Copy {weekScheds.length} shifts from {fmtShort(weekStart)} — {fmtShort(weekEnd)} as drafts:</p>
        {[1,2,3,4].map(w=>{const t=addDays(weekStart,w*7);const te=addDays(t,6);const exist=schedules.filter(s=>s.date>=toISO(t)&&s.date<=toISO(te)).length;
          return <button key={w} className="btn btn-s" style={{width:"100%",justifyContent:"space-between",padding:14,marginBottom:6}} onClick={()=>copyWeekTo(t)}>
            <span style={{fontWeight:600}}>{fmtShort(t)} — {fmtShort(te)}</span>
            {exist>0&&<span style={{fontSize:11,color:"#8a7356"}}>{exist} shifts exist</span>}
          </button>;
        })}
      </div>
    </div></div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
function DashPage({clients,caregivers,incidents,expenses,careNotes,events,trainingProgress,schedules,setPg}){
  const openInc=incidents.filter(i=>i.status==="open").length;
  const pendExp=expenses.filter(e=>e.status==="pending");
  const recentNotes=careNotes.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,4);
  const upcoming=events.filter(e=>new Date(e.date)>=now()).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,3);
  const avgTraining=Math.round(Object.values(trainingProgress).reduce((s,p)=>s+p.length,0)/Object.keys(trainingProgress).length/TRAINING_MODULES.length*100);

  return <div>
    <div className="hdr"><div><h2>Command Center</h2><div className="hdr-sub">{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div></div></div>

    <div className="sg">
      <div className="sc bl" style={{cursor:"pointer"}} onClick={()=>setPg("clients")}><span className="sl">Active Clients</span><span className="sv">{clients.filter(c=>c.status==="active").length}</span><span className="ss">{clients.length} total · Tap to view</span></div>
      <div className="sc ok" style={{cursor:"pointer"}} onClick={()=>setPg("team")}><span className="sl">Caregivers</span><span className="sv">{caregivers.filter(c=>c.status==="active").length}</span><span className="ss">All active · Tap to view</span></div>
      <div className="sc" style={{borderColor:openInc>0?"var(--err)":"var(--ok)",cursor:"pointer"}} onClick={()=>setPg("care")}><span className="sl">Open Incidents</span><span className="sv">{openInc}</span><span className="ss">{incidents.length} total · Tap to manage</span></div>
      <div className="sc wn" style={{cursor:"pointer"}} onClick={()=>setPg("expenses")}><span className="sl">Pending Expenses</span><span className="sv">{$(pendExp.reduce((s,e)=>s+e.amount,0))}</span><span className="ss">{pendExp.length} awaiting · Tap to review</span></div>
      <div className="sc pu" style={{cursor:"pointer"}} onClick={()=>setPg("training")}><span className="sl">Training Avg</span><span className="sv">{avgTraining}%</span><span className="ss">{TRAINING_MODULES.length} modules · Tap to view</span></div>
    </div>

    {/* AI Insights */}
    <div className="ai-card">
      <h4><span className="pulse" style={{background:"var(--ok)"}}/>CWIN AI Insights</h4>
      <p>
        {openInc>0&&`⚠️ ${openInc} open incident${openInc>1?"s":""} need attention. `}
        {pendExp.length>0&&`💰 ${pendExp.length} expense${pendExp.length>1?"s":""} (${$(pendExp.reduce((s,e)=>s+e.amount,0))}) pending approval. `}
        {upcoming.length>0&&`📅 Next event: ${upcoming[0].title} on ${fmtD(upcoming[0].date)}. `}
        {avgTraining<75&&`🎓 Team training at ${avgTraining}% — schedule a training day. `}
      </p>
    </div>

    {/* ═══ MONTHLY SCHEDULE OVERVIEW ═══ */}
    {(()=>{
      const allS=schedules||[];
      const mn=now().getMonth(),yr=now().getFullYear();
      const dim=new Date(yr,mn+1,0).getDate();
      const fdow=new Date(yr,mn,1).getDay();
      const bk=Array.from({length:fdow===0?6:(fdow-1)});
      const cds=Array.from({length:dim},(_,i)=>{const d=new Date(yr,mn,i+1);const iso=toISO(d);return{d,iso,day:i+1,dow:d.getDay(),sch:allS.filter(s=>s.date===iso),isToday:iso===toISO(now())};});
      const fwd=cds.filter(d=>d.dow!==0&&d.dow!==6&&new Date(d.iso)>=now());
      const gaps=fwd.filter(d=>d.sch.length===0);
      const cov=fwd.length>0?Math.round(((fwd.length-gaps.length)/fwd.length)*100):100;
      const mns=["January","February","March","April","May","June","July","August","September","October","November","December"];
      const cgaps=clients.filter(c=>c.status==="active").map(cl=>{const t=fwd.length;const cv=fwd.filter(d=>allS.some(s=>s.date===d.iso&&s.clientId===cl.id)).length;return{...cl,covered:cv,total:t,gaps:t-cv,pct:t>0?Math.round(cv/t*100):100};});

      return <div className="card" style={{marginBottom:16}}>
        <div className="card-h"><h3>Schedule Overview — {mns[mn]} {yr}</h3>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span className={`tag ${cov>=80?"tag-ok":cov>=50?"tag-wn":"tag-er"}`}>{cov}% coverage</span>
            {gaps.length>0&&<span className="tag tag-wn">{gaps.length} gaps</span>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"var(--border-thin)"}}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=> <div key={d} style={{padding:"8px 4px",textAlign:"center",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:"var(--t2)"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {bk.map((_,i)=> <div key={"b"+i} style={{minHeight:56,borderRight:"var(--border-thin)",borderBottom:"var(--border-thin)",background:"var(--bg)",opacity:.3}}/>)}
          {cds.map(cd=>{const gap=cd.sch.length===0&&cd.dow!==0&&cd.dow!==6&&new Date(cd.iso)>=now();const we=cd.dow===0||cd.dow===6;
            return <div key={cd.day} style={{minHeight:56,borderRight:"var(--border-thin)",borderBottom:"var(--border-thin)",padding:"3px 4px",background:cd.isToday?"rgba(60,79,61,.06)":gap?"rgba(138,115,86,.04)":we?"rgba(0,0,0,.015)":"var(--card)"}}>
              <div style={{fontSize:11,fontWeight:cd.isToday?700:400,color:cd.isToday?"#3c4f3d":we?"var(--t3)":"var(--text)"}}>{cd.day}</div>
              {cd.sch.slice(0,2).map((s,i)=>{const cg=caregivers.find(c=>c.id===s.caregiverId);return <div key={i} style={{fontSize:7,padding:"1px 3px",marginTop:1,background:s.color||"#3c4f3d",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.startTime} {cg?.name?.split(" ")[0]}</div>;})}
              {cd.sch.length>2&&<div style={{fontSize:7,color:"var(--t2)",marginTop:1}}>+{cd.sch.length-2}</div>}
              {gap&&<div style={{fontSize:6,padding:"1px 3px",marginTop:1,background:"rgba(138,115,86,.18)",color:"#8a7356",fontWeight:700,textTransform:"uppercase"}}>Gap</div>}
            </div>;
          })}
        </div>
        <div style={{display:"flex",gap:12,padding:"10px 20px",fontSize:10,color:"var(--t2)",flexWrap:"wrap",borderTop:"var(--border-thin)"}}>
          <span style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:8,height:8,background:"#3c4f3d"}}/> Shift</span>
          <span style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:8,height:8,background:"rgba(138,115,86,.18)",border:"1px solid rgba(138,115,86,.3)"}}/> Gap</span>
          <span style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:8,height:8,background:"rgba(60,79,61,.06)",border:"1px solid rgba(60,79,61,.2)"}}/> Today</span>
        </div>
        {/* Per-client coverage */}
        {cgaps.some(c=>c.gaps>0)&&<div style={{padding:"10px 20px",borderTop:"var(--border-thin)"}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:"var(--t2)",marginBottom:8}}>Client Coverage</div>
          {cgaps.map(c=> <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:600,width:100}}>{c.name}</span>
            <div style={{flex:1}}><div className="progress-bar"><div className="progress-fill" style={{width:`${c.pct}%`,background:c.pct>=80?"#3c4f3d":c.pct>=50?"#8a7356":"#7a3030"}}/></div></div>
            <span className={`tag ${c.pct>=80?"tag-ok":c.pct>=50?"tag-wn":"tag-er"}`} style={{fontSize:9,minWidth:40,textAlign:"center"}}>{c.pct}%</span>
          </div>)}
        </div>}
        {gaps.length>0&&<div style={{padding:"10px 20px",borderTop:"var(--border-thin)",fontSize:11,color:"#8a7356"}}>⚠️ {gaps.length} uncovered weekday{gaps.length>1?"s":""}: {gaps.slice(0,5).map(g=>fromISO(g.iso).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})).join(", ")}{gaps.length>5?` +${gaps.length-5} more`:""}</div>}
      </div>;
    })()}

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      {/* Recent Care Notes */}
      <div className="card">
        <div className="card-h"><h3>Recent Care Notes</h3><button className="btn btn-sm btn-s" onClick={()=>setPg("care")}>View All</button></div>
        {recentNotes.map(n=>{const cl=CLIENTS.find(c=>c.id===n.clientId);const cg=CAREGIVERS.find(c=>c.id===n.caregiverId);
          return <div key={n.id} style={{padding:"10px 18px",borderBottom:"1px solid var(--bdr)"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t2)",marginBottom:4}}><span>{cg?.name} → {cl?.name}</span><span>{fmtRel(n.date)}</span></div>
            <div style={{fontSize:12.5,lineHeight:1.5}}>{n.text.slice(0,120)}{n.text.length>120?"...":""}</div>
          </div>;})}
      </div>

      {/* Upcoming Events */}
      <div className="card">
        <div className="card-h"><h3>Upcoming Events</h3><button className="btn btn-sm btn-s" onClick={()=>setPg("events")}>View All</button></div>
        {upcoming.map(ev=>{const cl=CLIENTS.find(c=>c.id===ev.clientId);
          return <div key={ev.id} style={{padding:"10px 18px",borderBottom:"1px solid var(--bdr)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:600,fontSize:13}}>{ev.title}</div><div style={{fontSize:11,color:"var(--t2)"}}>{cl?.name} • {fmtD(ev.date)}</div></div>
              <span className={`tag ${ev.type==="medical"?"tag-er":"tag-bl"}`}>{ev.type}</span>
            </div>
          </div>;})}
        {upcoming.length===0&&<div className="empty">No upcoming events</div>}
      </div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// CLIENT PROFILES
// ═══════════════════════════════════════════════════════════════════════
function ClientsPage({clients,setClients,sel,setSel,caregivers,careNotes,incidents,events,chores,expenses,schedules}){
  const cl=clients.find(c=>c.id===sel)||clients.filter(c=>c.status!=="archived")[0]||clients[0];
  const [tab,setTab]=useState("overview");
  const [editField,setEditField]=useState(null);
  const [addInput,setAddInput]=useState("");
  const [editADL,setEditADL]=useState(null);
  const [editPref,setEditPref]=useState(null);
  const [editSocial,setEditSocial]=useState(null);
  const [editEmergency,setEditEmergency]=useState(null);
  const [editMed,setEditMed]=useState(null);
  const [calMonth,setCalMonth]=useState(now().getMonth());
  const [calYear,setCalYear]=useState(now().getFullYear());
  const [showAdd,setShowAdd]=useState(false);
  const [showEdit,setShowEdit]=useState(false);
  const [showArchived,setShowArchived]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const emptyClient={name:"",age:"",addr:"",phone:"",emergency:"",dx:[],meds:[],status:"active",riskLevel:"low",billRate:35,photo:null,adl:{},social:{interests:[]},preferences:{},familyPortal:{enabled:true,contacts:[]}};
  const [form,setForm]=useState(emptyClient);
  const [dxInput,setDxInput]=useState("");
  const [medInput,setMedInput]=useState("");

  const activeClients=showArchived?clients:clients.filter(c=>c.status!=="archived");
  const archivedCount=clients.filter(c=>c.status==="archived").length;

  const clNotes=careNotes.filter(n=>n.clientId===cl.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const clInc=incidents.filter(i=>i.clientId===cl.id);
  const clEvents=events.filter(e=>e.clientId===cl.id);
  const clChores=chores.filter(c=>c.clientId===cl.id);
  const clExp=expenses.filter(e=>e.clientId===cl.id);
  const clSchedules=(schedules||[]).filter(s=>s.clientId===cl.id);

  // ── UPDATE HELPERS ──
  const updateClient=(field,value)=>setClients(p=>p.map(c=>c.id===cl.id?{...c,[field]:value}:c));
  const addToArray=(field,val)=>{if(!val.trim())return;updateClient(field,[...cl[field],val.trim()]);setAddInput("");};
  const removeFromArray=(field,idx)=>updateClient(field,cl[field].filter((_,i)=>i!==idx));
  const updateNested=(parent,key,val)=>updateClient(parent,{...cl[parent],[key]:val});

  // ── MONTHLY CALENDAR ──
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const firstDayOfWeek=new Date(calYear,calMonth,1).getDay();
  const calDays=Array.from({length:daysInMonth},(_,i)=>{
    const d=new Date(calYear,calMonth,i+1);
    const iso=toISO(d);
    const dayScheds=clSchedules.filter(s=>s.date===iso);
    const dayNotes=careNotes.filter(n=>n.clientId===cl.id&&n.date&&n.date.startsWith(iso));
    const dayEvents=events.filter(e=>e.clientId===cl.id&&e.date&&e.date.startsWith(iso));
    const isToday=iso===toISO(now());
    return{date:d,iso,day:i+1,dow:d.getDay(),scheds:dayScheds,notes:dayNotes,events:dayEvents,isToday};
  });
  const blanks=Array.from({length:firstDayOfWeek===0?6:(firstDayOfWeek-1)});

  // ── GAP ANALYSIS ──
  const weekdays=calDays.filter(d=>d.dow!==0&&d.dow!==6);
  const noShiftDays=weekdays.filter(d=>d.scheds.length===0&&new Date(d.iso)>=now());
  const totalWeekdays=weekdays.filter(d=>new Date(d.iso)>=now()).length;
  const coveragePct=totalWeekdays>0?Math.round(((totalWeekdays-noShiftDays.length)/totalWeekdays)*100):100;
  const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];

  return <div>
    <div className="hdr"><div><h2>Client Profiles</h2><div className="hdr-sub">Comprehensive health, social, and care data</div></div>
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        <label style={{fontSize:10,display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Show archived ({archivedCount})</label>
        <select value={sel} onChange={e=>setSel(e.target.value)} style={{padding:"8px 12px",border:"var(--border-thin)",fontFamily:"var(--f)",fontWeight:600}}>
          {activeClients.map(c=> <option key={c.id} value={c.id}>{c.name}{c.status==="archived"?" (archived)":""}</option>)}
        </select>
        <button className="btn btn-p btn-sm" onClick={()=>{setForm(emptyClient);setDxInput("");setMedInput("");setShowAdd(true);}}>+ Add Client</button>
      </div>
    </div>

    {/* Client Header */}
    <div className="card card-b" style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
        <ProfileAvatar name={cl.name} photo={cl.photo} size={64} dark/>
        <PhotoUpload currentPhoto={cl.photo} onUpload={url=>setClients(p=>p.map(c=>c.id===cl.id?{...c,photo:url}:c))} entityType="client" entityId={cl.id} compact/>
      </div>
      <div style={{flex:1,minWidth:200}}>
        <div style={{fontFamily:"var(--fd)",fontSize:20,fontWeight:400}}>{cl.name}</div>
        <div style={{fontSize:12,color:"var(--t2)"}}>{cl.age} years old | {cl.addr}</div>
        <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
          <span className={`tag tag-${cl.riskLevel==="low"?"ok":cl.riskLevel==="medium"?"wn":"er"}`}>Risk: {cl.riskLevel.toUpperCase()}</span>
          {cl.dx.slice(0,3).map((d,i)=> <span key={i} className="tag tag-bl">{d}</span>)}
          {cl.dx.length>3&& <span className="tag tag-bl">+{cl.dx.length-3}</span>}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        <button className="btn btn-sm btn-s" onClick={()=>{setForm({...cl});setDxInput("");setMedInput("");setShowEdit(true);}}>✏️ Edit</button>
        {cl.status==="active"?
          <button className="btn btn-sm btn-s" style={{color:"var(--ochre)"}} onClick={()=>setClients(p=>p.map(c=>c.id===cl.id?{...c,status:"archived"}:c))}>📦 Archive</button>
          :<button className="btn btn-sm btn-ok" onClick={()=>setClients(p=>p.map(c=>c.id===cl.id?{...c,status:"active"}:c))}>♻️ Restore</button>
        }
        <button className="btn btn-sm btn-s" style={{color:"var(--err)"}} onClick={()=>setConfirmDelete(true)}>🗑 Delete</button>
      </div>
      <div style={{textAlign:"right"}}><div style={{fontSize:10,color:"var(--t2)",textTransform:"uppercase"}}>Bill Rate</div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400}}>${cl.billRate}/hr</div></div>
    </div>

    <div className="tab-row">
      {["overview","health","social","care","timeline"].map(t=> <button key={t} className={`tab-btn ${tab===t?"act":""}`} onClick={()=>setTab(t)}>{({overview:"📅 Overview",health:"🏥 Health & ADL",social:"🌱 Social",care:"📋 Care Plan",timeline:"📝 Timeline"})[t]}</button>)}
    </div>

    {/* ═══ OVERVIEW — Monthly Calendar + Gap Analysis ═══ */}
    {tab==="overview"&& <div>
      {/* AI Gap Analysis */}
      <div className="ai-card">
        <h4><span className="pulse" style={{background:coveragePct>=80?"#3c4f3d":"#8a7356"}}/>Schedule Coverage — {monthNames[calMonth]} {calYear}</h4>
        <p>
          {coveragePct}% weekday coverage for {cl.name} ({totalWeekdays-noShiftDays.length}/{totalWeekdays} remaining weekdays covered).
          {noShiftDays.length>0?` ⚠️ ${noShiftDays.length} uncovered weekday${noShiftDays.length>1?"s":""}: ${noShiftDays.slice(0,5).map(d=>fromISO(d.iso).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})).join(", ")}${noShiftDays.length>5?` and ${noShiftDays.length-5} more`:""}.`:" All upcoming weekdays are covered."}
          {clEvents.filter(e=>new Date(e.date)>=now()).length>0?` ${clEvents.filter(e=>new Date(e.date)>=now()).length} upcoming event${clEvents.filter(e=>new Date(e.date)>=now()).length>1?"s":""} this month.`:""}
          {cl.riskLevel==="medium"?" Recommend reviewing care plan frequency due to medium risk level.":""}
        </p>
      </div>

      {/* Calendar Navigation */}
      <div className="week-nav" style={{marginBottom:12}}>
        <button onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}}>←</button>
        <div className="wn-center" onClick={()=>{setCalMonth(now().getMonth());setCalYear(now().getFullYear());}}><div className="wn-label">{monthNames[calMonth]} {calYear}</div><div className="wn-sub">Tap for current month</div></div>
        <button onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}}>→</button>
      </div>

      {/* Calendar Grid */}
      <div className="card" style={{overflow:"visible"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"var(--border-thin)"}}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=> <div key={d} style={{padding:"8px 4px",textAlign:"center",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:"var(--t2)"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {blanks.map((_,i)=> <div key={"b"+i} style={{minHeight:72,border:"var(--border-thin)",background:"var(--bg)",opacity:.3}}/>)}
          {calDays.map(d=>{
            const hasGap=d.scheds.length===0&&d.dow!==0&&d.dow!==6&&new Date(d.iso)>=now();
            return <div key={d.day} style={{minHeight:72,border:"var(--border-thin)",padding:"4px 6px",background:d.isToday?"rgba(60,79,61,.08)":hasGap?"rgba(138,115,86,.06)":"var(--card)",position:"relative",cursor:"default"}}>
              <div style={{fontSize:12,fontWeight:d.isToday?700:400,color:d.isToday?"#3c4f3d":d.dow===0||d.dow===6?"var(--t3)":"var(--text)"}}>{d.day}</div>
              {d.scheds.map((s,i)=>{const cg=caregivers?.find(c=>c.id===s.caregiverId);return <div key={i} style={{fontSize:8,padding:"1px 4px",marginTop:2,background:s.color||"#3c4f3d",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.startTime} {cg?.name?.split(" ")[0]||""}</div>;})}
              {d.events.map((e,i)=> <div key={"e"+i} style={{fontSize:8,padding:"1px 4px",marginTop:2,background:e.type==="medical"?"rgba(122,48,48,.15)":"rgba(63,71,73,.1)",color:e.type==="medical"?"var(--err)":"var(--t2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.type==="medical"?"🏥":"🌱"} {e.title?.split(" ")[0]}</div>)}
              {hasGap&& <div style={{fontSize:7,padding:"1px 3px",marginTop:2,background:"rgba(138,115,86,.2)",color:"#8a7356",fontWeight:700,textTransform:"uppercase",letterSpacing:.3}}>Gap</div>}
            </div>;
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:14,marginTop:10,fontSize:10,color:"var(--t2)",flexWrap:"wrap"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,background:"#3c4f3d"}}/> Scheduled shift</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,background:"rgba(122,48,48,.15)",border:"1px solid rgba(122,48,48,.3)"}}/> Medical event</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,background:"rgba(138,115,86,.2)",border:"1px solid rgba(138,115,86,.3)"}}/> Coverage gap</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,background:"rgba(60,79,61,.08)",border:"1px solid rgba(60,79,61,.2)"}}/> Today</span>
      </div>

      {/* Quick Stats */}
      <div className="sg" style={{marginTop:16}}>
        <div className="sc ok"><span className="sl">Coverage</span><span className="sv">{coveragePct}%</span><span className="ss">weekday coverage</span></div>
        <div className="sc bl"><span className="sl">Shifts</span><span className="sv">{clSchedules.filter(s=>s.date&&s.date.startsWith(`${calYear}-${String(calMonth+1).padStart(2,"0")}`)).length}</span><span className="ss">this month</span></div>
        <div className="sc" style={{position:"relative"}}>{noShiftDays.length>0&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:"#8a7356"}}/>}<span className="sl">Gaps</span><span className="sv" style={{color:noShiftDays.length>0?"#8a7356":"var(--text)"}}>{noShiftDays.length}</span><span className="ss">uncovered days</span></div>
        <div className="sc"><span className="sl">Notes</span><span className="sv">{clNotes.length}</span><span className="ss">care notes</span></div>
      </div>
    </div>}

    {/* ═══ HEALTH — Editable ═══ */}
    {tab==="health"&& <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      {/* Diagnoses — Editable */}
      <div className="card">
        <div className="card-h"><h3>Diagnoses</h3><button className="btn btn-sm btn-s" onClick={()=>setEditField(editField==="dx"?null:"dx")}>{editField==="dx"?"Done":"Edit"}</button></div>
        <div className="card-b">
          {cl.dx.map((d,i)=> <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<cl.dx.length-1?"var(--border-thin)":""}}>
            <span style={{fontSize:13,fontWeight:600}}>{d}</span>
            {editField==="dx"&& <button style={{background:"none",border:"none",color:"var(--err)",cursor:"pointer",fontSize:14}} onClick={()=>removeFromArray("dx",i)}>✕</button>}
          </div>)}
          {editField==="dx"&& <TypeaheadInput list={DX_LIST} placeholder="Search diagnoses..." existing={cl.dx} onSelect={val=>addToArray("dx",val)}/>}
        </div>
      </div>

      {/* Medications — Enhanced with Dose, Frequency, Time, Reason, Pill Photo */}
      <div className="card">
        <div className="card-h"><h3>Medications</h3><button className="btn btn-sm btn-s" onClick={()=>setEditField(editField==="meds"?null:"meds")}>{editField==="meds"?"Done":"Edit"}</button></div>
        <div className="card-b">
          {cl.meds.map((m,i)=>{
            // Backwards compat: if med is a string, convert to object structure
            const med=typeof m==="string"?{name:m,dose:"",frequency:"",time:"",reason:"",photo:null}:m;
            return <div key={i} style={{padding:"10px 0",borderBottom:i<cl.meds.length-1?"var(--border-thin)":""}}>
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                {med.photo?<img src={med.photo} alt="Pill" style={{width:48,height:48,objectFit:"cover",border:"var(--border-thin)",cursor:"pointer"}} onClick={()=>window.open(med.photo,"_blank")}/>:<div style={{width:48,height:48,background:"var(--bg)",border:"1px dashed var(--bdr)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>💊</div>}
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700}}>{med.name}</div>
                  {med.dose&&<div style={{fontSize:11,color:"var(--t2)"}}><strong>Dose:</strong> {med.dose}</div>}
                  {med.frequency&&<div style={{fontSize:11,color:"var(--t2)"}}><strong>Frequency:</strong> {med.frequency}</div>}
                  {med.time&&<div style={{fontSize:11,color:"var(--t2)"}}><strong>Time:</strong> {med.time}</div>}
                  {med.reason&&<div style={{fontSize:11,color:"var(--t2)",fontStyle:"italic"}}>For: {med.reason}</div>}
                </div>
                {editField==="meds"&&<div style={{display:"flex",flexDirection:"column",gap:3}}>
                  <button className="btn btn-sm btn-s" style={{fontSize:9,padding:"3px 6px"}} onClick={()=>setEditMed({idx:i,...med})}>✏️ Edit</button>
                  <button style={{background:"none",border:"none",color:"var(--err)",cursor:"pointer",fontSize:14}} onClick={()=>removeFromArray("meds",i)}>✕</button>
                </div>}
              </div>
            </div>;
          })}
          {editField==="meds"&& <button className="btn btn-sm btn-p" style={{marginTop:8}} onClick={()=>setEditMed({idx:-1,name:"",dose:"",frequency:"Once daily",time:"",reason:"",photo:null})}>+ Add Medication</button>}
          {(!cl.meds||cl.meds.length===0)&&<div className="empty">No medications on file</div>}
        </div>
      </div>

      {/* ADL — Editable */}
      <div className="card" style={{gridColumn:"span 2"}}>
        <div className="card-h"><h3>ADL Status (8 Categories)</h3><button className="btn btn-sm btn-s" onClick={()=>setEditADL(editADL?null:{...cl.adl})}>{editADL?"Cancel":"Edit"}</button></div>
        <div className="card-b">
          {editADL? <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12,marginBottom:12}}>
              {Object.entries(editADL).map(([k,v])=>{const opts=ADL_OPTIONS[k]||[];return <div key={k} className="fi"><label>{k}</label><select value={v} onChange={e=>setEditADL(p=>({...p,[k]:e.target.value}))}>
                <option value="">Select level...</option>
                {opts.map(o=> <option key={o} value={o}>{o}</option>)}
              </select></div>;})}
            </div>
            <button className="btn btn-sm btn-p" onClick={()=>{updateClient("adl",editADL);setEditADL(null);}}>Save ADL</button>
          </div>
          : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
            {Object.entries(cl.adl).map(([k,v])=>{const short=v.split(" — ")[0];const desc=v.split(" — ")[1]||"";const isIndep=v.startsWith("Independent")||v.startsWith("Continent")||v.startsWith("Intact");const isDep=v.includes("Total dependence")||v.includes("Bedbound")||v.includes("Severe");const isMod=v.includes("Moderate")||v.includes("Maximum")||v.includes("Fall risk");
              return <div key={k} style={{padding:10,border:"var(--border-thin)",background:isDep?"var(--err-l)":isMod?"var(--warn-l)":isIndep?"var(--ok-l)":"var(--bg)"}}>
                <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:.6,color:"var(--t2)",fontWeight:700,marginBottom:4}}>{k}</div>
                <div style={{fontSize:12,fontWeight:600,color:isDep?"var(--err)":isMod?"#8a7356":"var(--text)"}}>{short}</div>
                {desc&& <div style={{fontSize:10,color:"var(--t2)",marginTop:2,lineHeight:1.4}}>{desc}</div>}
              </div>;
            })}
          </div>}
        </div>
      </div>

      {/* Emergency Contact — Editable */}
      <div className="card">
        <div className="card-h"><h3>Emergency Contact</h3><button className="btn btn-sm btn-s" onClick={()=>setEditEmergency(editEmergency?null:{val:cl.emergency,phone:cl.phone})}>{editEmergency?"Cancel":"Edit"}</button></div>
        <div className="card-b">{editEmergency? <div>
          <div className="fi" style={{marginBottom:8}}><label>Contact</label><input value={editEmergency.val} onChange={e=>setEditEmergency(p=>({...p,val:e.target.value}))}/></div>
          <div className="fi" style={{marginBottom:8}}><label>Phone</label><input value={editEmergency.phone} onChange={e=>setEditEmergency(p=>({...p,phone:e.target.value}))}/></div>
          <button className="btn btn-sm btn-p" onClick={()=>{updateClient("emergency",editEmergency.val);updateClient("phone",editEmergency.phone);setEditEmergency(null);}}>Save</button>
        </div>:<div><div style={{fontSize:14,fontWeight:600}}>{cl.emergency}</div><div style={{fontSize:12,color:"var(--t2)",marginTop:2}}>{cl.phone}</div></div>}</div>
      </div>

      {/* Risk Level — Editable */}
      <div className="card">
        <div className="card-h"><h3>Risk Level & Billing</h3></div>
        <div className="card-b">
          <div className="fi" style={{marginBottom:10}}><label>Risk Level</label>
            <div style={{display:"flex",gap:6}}>{["low","medium","high"].map(r=> <div key={r} onClick={()=>updateClient("riskLevel",r)} style={{flex:1,padding:10,textAlign:"center",border:`1.5px solid ${cl.riskLevel===r?"var(--black)":"var(--bdr)"}`,background:cl.riskLevel===r?"var(--black)":"var(--card)",color:cl.riskLevel===r?"#fff":"var(--text)",fontSize:12,fontWeight:600,cursor:"pointer",textTransform:"uppercase"}}>{r}</div>)}</div>
          </div>
          <div className="fi"><label>Bill Rate ($/hr)</label><input type="number" value={cl.billRate} onChange={e=>updateClient("billRate",+e.target.value)} step="0.5" style={{fontWeight:700}}/></div>
        </div>
      </div>

      {/* Incidents */}
      <div className="card" style={{gridColumn:"span 2"}}><div className="card-h"><h3>Incidents ({clInc.length})</h3></div><div className="card-b">{clInc.length===0? <div className="empty">No incidents</div>:clInc.slice(0,3).map(inc=> <div key={inc.id} style={{padding:"6px 0",borderBottom:"var(--border-thin)",fontSize:12}}><span className={`tag ${inc.severity==="low"?"tag-wn":"tag-er"}`} style={{marginRight:6}}>{inc.type}</span>{inc.description.slice(0,80)}...</div>)}</div></div>

      {/* AI Clinical Agent */}
      <div style={{gridColumn:"span 2"}}><ClinicalAgent cl={cl} incidents={incidents} careNotes={careNotes}/></div>
    </div>}

    {/* ═══ SOCIAL — Editable ═══ */}
    {tab==="social"&& <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      {/* Interests — Editable */}
      <div className="card">
        <div className="card-h"><h3>Interests & Hobbies</h3><button className="btn btn-sm btn-s" onClick={()=>setEditField(editField==="interests"?null:"interests")}>{editField==="interests"?"Done":"Edit"}</button></div>
        <div className="card-b">
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {cl.social.interests.map((int,i)=> <span key={i} className="tag tag-bl" style={{cursor:editField==="interests"?"pointer":"default"}} onClick={()=>editField==="interests"&&updateNested("social","interests",cl.social.interests.filter((_,j)=>j!==i))}>{int}{editField==="interests"?" ✕":""}</span>)}
          </div>
          {editField==="interests"&& <TypeaheadInput list={INTERESTS_LIST} placeholder="Search interests & hobbies..." existing={cl.social.interests} onSelect={val=>updateNested("social","interests",[...cl.social.interests,val])}/>}
        </div>
      </div>

      {/* Personal Details — Editable */}
      <div className="card">
        <div className="card-h"><h3>Personal Details</h3><button className="btn btn-sm btn-s" onClick={()=>setEditSocial(editSocial?null:{...cl.social})}>{editSocial?"Cancel":"Edit"}</button></div>
        <div className="card-b">{editSocial? <div>
          <div className="fi" style={{marginBottom:8}}><label>Faith</label><input value={editSocial.faith} onChange={e=>setEditSocial(p=>({...p,faith:e.target.value}))}/></div>
          <div className="fi" style={{marginBottom:8}}><label>Pets</label><input value={editSocial.pets} onChange={e=>setEditSocial(p=>({...p,pets:e.target.value}))}/></div>
          <div className="fi" style={{marginBottom:8}}><label>Birthday</label><input type="date" value={editSocial.birthday} onChange={e=>setEditSocial(p=>({...p,birthday:e.target.value}))}/></div>
          <button className="btn btn-sm btn-p" onClick={()=>{updateClient("social",editSocial);setEditSocial(null);}}>Save</button>
        </div>:<div style={{fontSize:13,lineHeight:2}}>
          <div><strong>Faith:</strong> {cl.social.faith}</div>
          <div><strong>Pets:</strong> {cl.social.pets||"None"}</div>
          <div><strong>Birthday:</strong> {fmtD(cl.social.birthday)}</div>
        </div>}</div>
      </div>

      {/* Preferences — Editable */}
      <div className="card" style={{gridColumn:"span 2"}}>
        <div className="card-h"><h3>Daily Preferences</h3><button className="btn btn-sm btn-s" onClick={()=>setEditPref(editPref?null:{...cl.preferences})}>{editPref?"Cancel":"Edit"}</button></div>
        <div className="card-b">{editPref? <div>
          <div className="fg" style={{gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",marginBottom:12}}>
            {Object.entries(editPref).map(([k,v])=> <div key={k} className="fi"><label>{k.replace(/([A-Z])/g," $1")}</label><input value={Array.isArray(v)?v.join(", "):v} onChange={e=>setEditPref(p=>({...p,[k]:k==="tvShows"?e.target.value.split(",").map(s=>s.trim()):e.target.value}))}/></div>)}
          </div>
          <button className="btn btn-sm btn-p" onClick={()=>{updateClient("preferences",editPref);setEditPref(null);}}>Save Preferences</button>
        </div>:<div className="fg" style={{gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))"}}>
          {Object.entries(cl.preferences).map(([k,v])=> <div key={k}><div style={{fontSize:10,textTransform:"uppercase",color:"var(--t2)",fontWeight:600,marginBottom:3}}>{k.replace(/([A-Z])/g," $1")}</div><div style={{fontSize:13,fontWeight:600}}>{Array.isArray(v)?v.join(", "):v}</div></div>)}
        </div>}</div>
      </div>

      {/* AI Social Agent */}
      <div style={{gridColumn:"span 2"}}><SocialAgent cl={cl}/></div>
    </div>}

    {/* ═══ CARE ═══ */}
    {tab==="care"&& <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div className="card"><div className="card-h"><h3>Active Chores & Tasks</h3></div>
        {clChores.map(ch=> <div key={ch.id} style={{padding:"10px 18px",borderBottom:"var(--border-thin)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:600,fontSize:13}}>{ch.title}</div><div style={{fontSize:11,color:"var(--t2)"}}>{ch.frequency} | Last: {fmtD(ch.lastDone)}</div></div>
          <span className={`tag ${ch.priority==="high"?"tag-er":"tag-ok"}`}>{ch.priority}</span>
        </div>)}
        {clChores.length===0&& <div className="empty">No active tasks</div>}
      </div>
      <div className="card"><div className="card-h"><h3>Expenses This Period</h3></div>
        {clExp.length===0? <div className="empty">No expenses</div>:clExp.map(ex=> <div key={ex.id} style={{padding:"10px 18px",borderBottom:"var(--border-thin)",display:"flex",justifyContent:"space-between"}}>
          <div><div style={{fontWeight:600,fontSize:13}}>{ex.description}</div><div style={{fontSize:11,color:"var(--t2)"}}>{ex.category} | {fmtD(ex.date)}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontWeight:700}}>{$(ex.amount)}</div><span className={`tag ${ex.status==="approved"?"tag-ok":"tag-wn"}`}>{ex.status}</span></div>
        </div>)}
      </div>
    </div>}

    {/* ═══ TIMELINE ═══ */}
    {tab==="timeline"&& <div className="card"><div className="card-h"><h3>Care Timeline</h3></div>
      {clNotes.map(n=>{const cg=(caregivers||CAREGIVERS).find(c=>c.id===n.caregiverId);return <div key={n.id} style={{padding:"12px 18px",borderBottom:"var(--border-thin)"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t2)",marginBottom:4}}>
          <span style={{fontWeight:600}}>{cg?.name}</span>
          <span>{fmtD(n.date)} {fmtT(n.date)}</span>
        </div>
        <span className={`tag ${NOTE_CATS[n.category]?.color||"tag-ok"}`} style={{marginBottom:6,display:"inline-flex"}}>{n.category}</span>
        <div style={{fontSize:13,lineHeight:1.6,marginTop:4}}>{n.text}</div>
        {n.photos&&n.photos.length>0&&<div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>{n.photos.map(ph=><a key={ph.id} href={ph.url} target="_blank" rel="noopener noreferrer"><img src={ph.url} alt="Task" style={{width:80,height:80,objectFit:"cover",border:"var(--border-thin)",cursor:"pointer"}}/></a>)}</div>}
      </div>;})}
      {clNotes.length===0&& <div className="empty">No care notes yet</div>}
    </div>}

    {/* Medication Edit Modal */}
    {editMed&&<div className="modal-bg" onClick={()=>setEditMed(null)}><div className="modal" style={{maxWidth:520,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">{editMed.idx===-1?"Add Medication":"Edit Medication"}<button className="btn btn-sm btn-s" onClick={()=>setEditMed(null)}>✕</button></div>
      <div className="modal-b">
        <div className="fi" style={{marginBottom:10}}><label>Medication Name *</label><input value={editMed.name} onChange={e=>setEditMed(p=>({...p,name:e.target.value}))} placeholder="e.g. Lisinopril, Metformin"/></div>
        <div className="fg" style={{marginBottom:10}}>
          <div className="fi"><label>Dose</label><input value={editMed.dose} onChange={e=>setEditMed(p=>({...p,dose:e.target.value}))} placeholder="e.g. 10mg, 500mg, 2 tablets"/></div>
          <div className="fi"><label>Frequency</label><select value={editMed.frequency} onChange={e=>setEditMed(p=>({...p,frequency:e.target.value}))}><option>Once daily</option><option>Twice daily</option><option>Three times daily</option><option>Four times daily</option><option>Every 4 hours</option><option>Every 6 hours</option><option>Every 8 hours</option><option>Every 12 hours</option><option>As needed (PRN)</option><option>Weekly</option><option>Monthly</option></select></div>
        </div>
        <div className="fi" style={{marginBottom:10}}><label>Time(s) of Day</label><input value={editMed.time} onChange={e=>setEditMed(p=>({...p,time:e.target.value}))} placeholder="e.g. 8:00 AM, 12:00 PM, 6:00 PM"/></div>
        <div className="fi" style={{marginBottom:10}}><label>Reason / Condition</label><input value={editMed.reason} onChange={e=>setEditMed(p=>({...p,reason:e.target.value}))} placeholder="e.g. High blood pressure, Diabetes"/></div>
        
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:6}}>💊 Pill Photo</label>
          {editMed.photo?<div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <img src={editMed.photo} alt="Pill" style={{maxWidth:120,maxHeight:120,border:"var(--border-thin)",objectFit:"cover"}}/>
            <div>
              <label className="btn btn-sm btn-s" style={{cursor:"pointer"}}>📷 Replace
                <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{
                  const file=e.target.files[0];if(!file)return;
                  if(!file.type.startsWith("image/")){alert("Please select an image");return;}
                  if(file.size>5*1024*1024){alert("Image must be under 5MB");return;}
                  const reader=new FileReader();
                  reader.onload=(ev)=>{
                    const img=new Image();
                    img.onload=()=>{
                      const canvas=document.createElement("canvas");
                      const max=400;let w=img.width,h=img.height;
                      if(w>h){if(w>max){h=h*(max/w);w=max;}}else{if(h>max){w=w*(max/h);h=max;}}
                      canvas.width=w;canvas.height=h;
                      canvas.getContext("2d").drawImage(img,0,0,w,h);
                      setEditMed(p=>({...p,photo:canvas.toDataURL("image/jpeg",0.85)}));
                    };
                    img.src=ev.target.result;
                  };
                  reader.readAsDataURL(file);
                }}/>
              </label>
              <button className="btn btn-sm btn-s" style={{marginLeft:6,color:"var(--err)"}} onClick={()=>setEditMed(p=>({...p,photo:null}))}>🗑 Remove</button>
            </div>
          </div>
          :<label className="btn btn-sm btn-p" style={{cursor:"pointer",display:"inline-flex",gap:4}}>📷 Take Photo of Pill
            <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{
              const file=e.target.files[0];if(!file)return;
              if(!file.type.startsWith("image/")){alert("Please select an image");return;}
              if(file.size>5*1024*1024){alert("Image must be under 5MB");return;}
              const reader=new FileReader();
              reader.onload=(ev)=>{
                const img=new Image();
                img.onload=()=>{
                  const canvas=document.createElement("canvas");
                  const max=400;let w=img.width,h=img.height;
                  if(w>h){if(w>max){h=h*(max/w);w=max;}}else{if(h>max){w=w*(max/h);h=max;}}
                  canvas.width=w;canvas.height=h;
                  canvas.getContext("2d").drawImage(img,0,0,w,h);
                  setEditMed(p=>({...p,photo:canvas.toDataURL("image/jpeg",0.85)}));
                };
                img.src=ev.target.result;
              };
              reader.readAsDataURL(file);
            }}/>
          </label>}
          <div style={{fontSize:10,color:"var(--t2)",marginTop:6}}>Helps caregivers identify the correct pill to administer.</div>
        </div>

        <button className="btn btn-p" style={{width:"100%"}} disabled={!editMed.name?.trim()} onClick={()=>{
          const med={name:editMed.name,dose:editMed.dose,frequency:editMed.frequency,time:editMed.time,reason:editMed.reason,photo:editMed.photo};
          setClients(p=>p.map(c=>{if(c.id!==cl.id)return c;
            const newMeds=[...(c.meds||[])];
            if(editMed.idx===-1)newMeds.push(med);
            else newMeds[editMed.idx]=med;
            return{...c,meds:newMeds};
          }));
          setEditMed(null);
        }}>{editMed.idx===-1?"Add Medication":"Save Changes"}</button>
      </div>
    </div></div>}

    {/* Add/Edit Client Modal */}
    {(showAdd||showEdit)&& <div className="modal-bg" onClick={()=>{setShowAdd(false);setShowEdit(false);}}><div className="modal" style={{maxWidth:600,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">{showAdd?"Add New Client":"Edit Client"}<button className="btn btn-sm btn-s" onClick={()=>{setShowAdd(false);setShowEdit(false);}}>✕</button></div>
      <div className="modal-b">
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Full Name *</label><input value={form.name||""} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. John Smith"/></div>
          <div className="fi"><label>Age</label><input type="number" value={form.age||""} onChange={e=>setForm(p=>({...p,age:parseInt(e.target.value)||""}))} placeholder="e.g. 75"/></div>
        </div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Address</label><input value={form.addr||form.address||""} onChange={e=>setForm(p=>({...p,addr:e.target.value}))} placeholder="e.g. 123 Main St, Chicago IL 60601"/></div>
          <div className="fi"><label>Phone</label><input value={form.phone||""} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="e.g. 312-555-0100"/></div>
        </div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Emergency Contact</label><input value={form.emergency||""} onChange={e=>setForm(p=>({...p,emergency:e.target.value}))} placeholder="e.g. Jane Smith (daughter) 312-555-0101"/></div>
          <div className="fi"><label>Bill Rate ($/hr)</label><input type="number" value={form.billRate||""} onChange={e=>setForm(p=>({...p,billRate:parseFloat(e.target.value)||0}))} placeholder="35"/></div>
        </div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Risk Level</label><select value={form.riskLevel||"low"} onChange={e=>setForm(p=>({...p,riskLevel:e.target.value}))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          <div className="fi"><label>Status</label><select value={form.status||"active"} onChange={e=>setForm(p=>({...p,status:e.target.value}))}><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option><option value="discharged">Discharged</option></select></div>
        </div>
        {/* Diagnoses */}
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Diagnoses</label>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>{(form.dx||[]).map((d,i)=><span key={i} className="tag tag-bl" style={{cursor:"pointer"}} onClick={()=>setForm(p=>({...p,dx:p.dx.filter((_,j)=>j!==i)}))}>{d} ✕</span>)}</div>
          <div style={{display:"flex",gap:4}}><input value={dxInput} onChange={e=>setDxInput(e.target.value)} placeholder="Add diagnosis" onKeyDown={e=>{if(e.key==="Enter"&&dxInput.trim()){setForm(p=>({...p,dx:[...(p.dx||[]),dxInput.trim()]}));setDxInput("");}}} style={{flex:1}}/><button className="btn btn-sm btn-s" onClick={()=>{if(dxInput.trim()){setForm(p=>({...p,dx:[...(p.dx||[]),dxInput.trim()]}));setDxInput("");}}}>Add</button></div>
        </div>
        {/* Medications */}
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Medications</label>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>{(form.meds||[]).map((m,i)=><span key={i} className="tag tag-wn" style={{cursor:"pointer"}} onClick={()=>setForm(p=>({...p,meds:p.meds.filter((_,j)=>j!==i)}))}>{m} ✕</span>)}</div>
          <div style={{display:"flex",gap:4}}><input value={medInput} onChange={e=>setMedInput(e.target.value)} placeholder="Add medication" onKeyDown={e=>{if(e.key==="Enter"&&medInput.trim()){setForm(p=>({...p,meds:[...(p.meds||[]),medInput.trim()]}));setMedInput("");}}} style={{flex:1}}/><button className="btn btn-sm btn-s" onClick={()=>{if(medInput.trim()){setForm(p=>({...p,meds:[...(p.meds||[]),medInput.trim()]}));setMedInput("");}}}>Add</button></div>
        </div>
        <button className="btn btn-p" style={{width:"100%"}} disabled={!form.name?.trim()} onClick={()=>{
          if(showAdd){
            const newId="CL"+uid();
            const newClient={...emptyClient,...form,id:newId,dx:form.dx||[],meds:form.meds||[]};
            setClients(p=>[...p,newClient]);
            setSel(newId);
            setShowAdd(false);
          }else{
            setClients(p=>p.map(c=>c.id===form.id?{...c,...form}:c));
            setShowEdit(false);
          }
        }}>{showAdd?"Add Client":"Save Changes"}</button>
      </div>
    </div></div>}

    {/* Delete Confirmation */}
    {confirmDelete&& <div className="modal-bg" onClick={()=>setConfirmDelete(false)}><div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">Delete Client<button className="btn btn-sm btn-s" onClick={()=>setConfirmDelete(false)}>✕</button></div>
      <div className="modal-b" style={{textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
        <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Delete {cl.name}?</div>
        <div style={{fontSize:12,color:"var(--t2)",marginBottom:16}}>This will permanently remove this client and all associated data. This action cannot be undone. Consider archiving instead.</div>
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          <button className="btn btn-s" onClick={()=>setConfirmDelete(false)}>Cancel</button>
          <button className="btn btn-sm" style={{background:"var(--ochre)",color:"#fff"}} onClick={()=>{setClients(p=>p.map(c=>c.id===cl.id?{...c,status:"archived"}:c));setConfirmDelete(false);}}>Archive Instead</button>
          <button className="btn btn-sm" style={{background:"var(--err)",color:"#fff"}} onClick={()=>{setClients(p=>p.filter(c=>c.id!==cl.id));setSel(clients[0]?.id||"");setConfirmDelete(false);}}>Delete Permanently</button>
        </div>
      </div>
    </div></div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// CARE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════
function CarePage({clients,caregivers,chores,setChores,incidents,setIncidents,careNotes,setCareNotes,modal,setModal}){
  const [tab,setTab]=useState("tasks");

  return <div>
    <div className="hdr"><div><h2>Care Management</h2><div className="hdr-sub">Tasks, incidents, and case management</div></div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-p btn-sm" onClick={()=>setModal("note")}>📝 Care Note</button>
        <button className="btn btn-er btn-sm" onClick={()=>setModal("incident")}>⚠️ Incident</button>
      </div>
    </div>

    {/* AI Case Agent */}
    <div className="ai-card">
      <h4><span className="pulse" style={{background:"var(--ok)"}}/>CWIN Case Management Agent</h4>
      <p>
        <strong>Active Flags:</strong> {incidents.filter(i=>i.status==="open").length} open incidents requiring follow-up.
        {incidents.filter(i=>i.status==="open").map(i=>{const cl=clients.find(c=>c.id===i.clientId);return` ${cl?.name}: ${i.type} (${i.severity}) — ${i.followUp||"needs follow-up plan"}. `;})}
        <br/><strong>Recommendations:</strong> Schedule care plan review for Linda Frank (2 incidents in 10 days). Verify medication compliance for Steven Brown. All chore schedules current.
      </p>
    </div>

    <div className="tab-row">
      {["tasks","incidents","notes","agent"].map(t=><button key={t} className={`tab-btn ${tab===t?"act":""}`} onClick={()=>setTab(t)}>{({tasks:"📋 Tasks & Chores",incidents:"⚠️ Incidents",notes:"📝 Care Notes",agent:"🤖 Case Agent"})[t]}</button>)}
    </div>

    {tab==="tasks"&&<div className="card"><div className="card-h"><h3>Active Tasks & Chores</h3></div>
      <div className="tw"><table><thead><tr><th>Task</th><th>Client</th><th>Frequency</th><th>Assigned</th><th>Last Done</th><th>Priority</th><th>Status</th></tr></thead><tbody>
        {chores.map(ch=>{const cl=clients.find(c=>c.id===ch.clientId);const cg=caregivers.find(c=>c.id===ch.assignedTo);
          return <tr key={ch.id}><td style={{fontWeight:600}}>{ch.title}</td><td>{cl?.name}</td><td>{ch.frequency}</td><td>{cg?.name}</td><td>{fmtD(ch.lastDone)}</td>
            <td><span className={`tag ${ch.priority==="high"?"tag-er":"tag-ok"}`}>{ch.priority}</span></td>
            <td><button className="btn btn-sm btn-ok" onClick={()=>setChores(p=>p.map(c=>c.id===ch.id?{...c,lastDone:today()}:c))}>✓ Done</button></td></tr>;})}
      </tbody></table></div>
    </div>}

    {tab==="incidents"&&<div className="card"><div className="card-h"><h3>Incident Reports</h3></div>
      <div className="tw"><table><thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Severity</th><th>Description</th><th>Family</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {incidents.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(inc=>{const cl=clients.find(c=>c.id===inc.clientId);
          return <tr key={inc.id}><td>{fmtD(inc.date)}</td><td style={{fontWeight:600}}>{cl?.name}</td><td>{inc.type}</td>
            <td><span className={`tag ${inc.severity==="low"?"tag-wn":inc.severity==="medium"?"tag-er":"tag-er"}`}>{inc.severity}</span></td>
            <td style={{maxWidth:200,fontSize:12}}>{inc.description.slice(0,80)}...</td>
            <td>{inc.familyNotified?<span className="tag tag-ok">Yes</span>:<span className="tag tag-wn">No</span>}</td>
            <td><span className={`tag ${inc.status==="resolved"?"tag-ok":"tag-er"}`}>{inc.status}</span></td>
            <td>{inc.status==="open"&&<button className="btn btn-sm btn-ok" onClick={()=>setIncidents(p=>p.map(i=>i.id===inc.id?{...i,status:"resolved"}:i))}>Resolve</button>}</td></tr>;})}
      </tbody></table></div>
    </div>}

    {tab==="notes"&&<div className="card"><div className="card-h"><h3>Care Notes</h3></div>
      {careNotes.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(n=>{const cl=clients.find(c=>c.id===n.clientId);const cg=caregivers.find(c=>c.id===n.caregiverId);
        return <div key={n.id} style={{padding:"12px 18px",borderBottom:"1px solid var(--bdr)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}><span className={`tag ${NOTE_CATS[n.category]?.color||"tag-ok"}`}>{n.category}</span><span style={{fontWeight:600,fontSize:13}}>{cg?.name} → {cl?.name}</span></div>
            <span style={{fontSize:11,color:"var(--t2)"}}>{fmtD(n.date)} {fmtT(n.date)}</span>
          </div>
          <div style={{fontSize:13,lineHeight:1.6}}>{n.text}</div>
          {n.photos&&n.photos.length>0&&<div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>{n.photos.map(ph=><a key={ph.id} href={ph.url} target="_blank" rel="noopener noreferrer"><img src={ph.url} alt="Task" style={{width:60,height:60,objectFit:"cover",border:"var(--border-thin)",cursor:"pointer"}}/></a>)}</div>}
        </div>;})}
    </div>}

    {tab==="agent"&&<div>
      <div className="ai-card">
        <h4>🤖 Agentic Case Management</h4>
        <p>The CWIN Case Agent continuously monitors all client data, incidents, care notes, chore completion, and health trends to provide proactive recommendations.</p>
      </div>
      {clients.map(cl=>{const clInc=incidents.filter(i=>i.clientId===cl.id);const clNotes=careNotes.filter(n=>n.clientId===cl.id);
        return <div key={cl.id} className="card card-b" style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:400}}>{cl.name}</div>
            <span className={`tag tag-${cl.riskLevel==="low"?"ok":cl.riskLevel==="medium"?"wn":"er"}`}>Risk: {cl.riskLevel}</span>
          </div>
          <div style={{fontSize:12,lineHeight:1.7,color:"var(--t2)"}}>
            <div><strong>Incidents:</strong> {clInc.length} total ({clInc.filter(i=>i.status==="open").length} open)</div>
            <div><strong>Recent Notes:</strong> {clNotes.length} entries</div>
            <div><strong>Diagnoses:</strong> {cl.dx.join(", ")}</div>
            <div style={{marginTop:8,padding:"8px 12px",background:"var(--bg)",borderRadius:"var(--rs)",borderLeft:"3px solid var(--purple)"}}>
              <strong style={{color:"var(--purple)"}}>AI Assessment:</strong> {cl.riskLevel==="medium"?`Elevated monitoring recommended. ${cl.dx.length} active conditions with ${clInc.length} recent incident${clInc.length!==1?"s":""}. Consider care plan review.`:`Current care plan adequate. Continue monitoring at standard frequency.`}
            </div>
          </div>
        </div>;})}
    </div>}

    {/* MODALS */}
    {modal==="note"&&<div className="modal-bg" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">📝 New Care Note<button className="btn btn-sm btn-s" onClick={()=>setModal(null)}>✕</button></div>
      <NoteForm clients={clients} caregivers={caregivers} onSave={n=>{setCareNotes(p=>[{id:"CN"+uid(),...n,date:now().toISOString()},...p]);setModal(null);}}/>
    </div></div>}
    {modal==="incident"&&<div className="modal-bg" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">⚠️ Incident Report<button className="btn btn-sm btn-s" onClick={()=>setModal(null)}>✕</button></div>
      <IncidentForm clients={clients} caregivers={caregivers} onSave={inc=>{setIncidents(p=>[{id:"IR"+uid(),...inc,date:now().toISOString(),status:"open"},...p]);setModal(null);}}/>
    </div></div>}
  </div>;
}

function NoteForm({clients,caregivers,onSave}){
  const [f,sF]=useState({clientId:clients[0]?.id||"CL1",caregiverId:caregivers[0]?.id||"CG1",category:"General",text:"",subData:{},photos:[]});
  const [aiLoading,setAiLoading]=useState(false);
  const [aiError,setAiError]=useState("");
  const [uploadingPhoto,setUploadingPhoto]=useState(false);
  const cat=NOTE_CATS[f.category];
  const updateSub=(key,val)=>sF(p=>({...p,subData:{...p.subData,[key]:val}}));

  // Add photo to note
  const addPhoto=async(file)=>{
    if(!file)return;
    if(!file.type.startsWith("image/")){alert("Please select an image");return;}
    if(file.size>5*1024*1024){alert("Image must be under 5MB");return;}
    setUploadingPhoto(true);
    const reader=new FileReader();
    reader.onload=async(ev)=>{
      const img=new Image();
      img.onload=async()=>{
        const canvas=document.createElement("canvas");
        const max=800;let w=img.width,h=img.height;
        if(w>h){if(w>max){h=h*(max/w);w=max;}}else{if(h>max){w=w*(max/h);h=max;}}
        canvas.width=w;canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        const base64=canvas.toDataURL("image/jpeg",0.85);
        // Upload to Supabase
        const photoId="note_"+Date.now()+"_"+Math.random().toString(36).slice(2,7);
        const url=await sbUploadReceipt(base64,photoId);
        sF(p=>({...p,photos:[...(p.photos||[]),{id:photoId,url:url||base64,timestamp:new Date().toISOString()}]}));
        setUploadingPhoto(false);
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  const removePhoto=(id)=>sF(p=>({...p,photos:(p.photos||[]).filter(ph=>ph.id!==id)}));

  // AI Care Note Assistant — expands brief notes to full clinical documentation
  const aiExpand=async()=>{
    if(!f.text.trim()){setAiError("Please write a brief note first, then click AI Expand");return;}
    setAiLoading(true);setAiError("");
    try{
      const cl=clients.find(c=>c.id===f.clientId);
      const cg=caregivers.find(c=>c.id===f.caregiverId);
      const subSummary=Object.entries(f.subData).filter(([_,v])=>v&&v!=="").map(([k,v])=>{const fl=cat?.fields?.find(x=>x.key===k);return `${fl?.label||k}: ${typeof v==="boolean"?(v?"yes":"no"):v}`;}).join(", ");
      const prompt=`You are an expert home care documentation assistant for CWIN At Home in Chicago. Expand this brief care note into professional, objective clinical documentation suitable for a home care record.

CLIENT: ${cl?.name}, age ${cl?.age}
DIAGNOSES: ${cl?.dx?.join(", ")||"none"}
CAREGIVER: ${cg?.name}
CATEGORY: ${f.category}
${subSummary?"TRACKED DATA: "+subSummary:""}

CAREGIVER'S BRIEF NOTE:
"${f.text}"

INSTRUCTIONS:
- Expand into 2-4 sentences of professional clinical documentation
- Use objective, observable language (not opinions)
- Match home care charting style: clear, factual, time-stamped where relevant
- Include any relevant client status, response to care, and observations
- Do NOT make up specific data not provided
- Do NOT use medical diagnoses unless mentioned in the original note
- Output ONLY the expanded note text, no preamble or explanation`;
      
      const resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,messages:[{role:"user",content:prompt}]})
      });
      const data=await resp.json();
      const expanded=data.content?.find(c=>c.type==="text")?.text||"";
      if(expanded)sF(p=>({...p,text:expanded.trim()}));
      else setAiError("AI returned no content. Try again.");
    }catch(e){setAiError("AI error: "+(e.message||"unknown"));}
    setAiLoading(false);
  };

  return <div className="modal-b">
    <div className="fg" style={{marginBottom:12}}>
      <div className="fi"><label>Client</label><select value={f.clientId} onChange={e=>sF({...f,clientId:e.target.value})}>{clients.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="fi"><label>Caregiver</label><select value={f.caregiverId} onChange={e=>sF({...f,caregiverId:e.target.value})}>{caregivers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    </div>

    {/* Category selector */}
    <div className="fi" style={{marginBottom:12}}><label>Documentation Category</label>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:4}}>
        {Object.entries(NOTE_CATS).map(([k,v])=> <div key={k} onClick={()=>sF(p=>({...p,category:k,subData:{}}))} style={{padding:"6px 8px",border:`1.5px solid ${f.category===k?"var(--black)":"var(--bdr)"}`,background:f.category===k?"var(--black)":"var(--card)",color:f.category===k?"#fff":"var(--text)",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:".15s"}}>
          <span>{v.icon}</span><span style={{fontWeight:600}}>{k}</span>
        </div>)}
      </div>
    </div>

    {/* Category description */}
    {cat&&cat.desc&& <div style={{fontSize:11,color:"var(--t2)",marginBottom:10,padding:"6px 10px",background:"var(--bg)"}}>{cat.icon} {cat.desc}{cat.fields.length>0?` — ${cat.fields.length} tracking fields`:""}</div>}

    {/* Sub-tracking fields */}
    {cat&&cat.fields.length>0&& <div style={{border:"var(--border-thin)",padding:14,marginBottom:12,background:"rgba(0,0,0,.01)"}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)",marginBottom:10}}>📊 {f.category} Tracking</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
        {cat.fields.map(field=> <div key={field.key} className="fi">
          <label>{field.label}</label>
          {field.type==="select"&& <select value={f.subData[field.key]||""} onChange={e=>updateSub(field.key,e.target.value)}>
            <option value="">Select...</option>
            {field.opts.map(o=> <option key={o} value={o}>{o}</option>)}
          </select>}
          {field.type==="text"&& <input value={f.subData[field.key]||""} onChange={e=>updateSub(field.key,e.target.value)} placeholder={field.placeholder||""}/>}
          {field.type==="number"&& <input type="number" value={f.subData[field.key]||""} onChange={e=>updateSub(field.key,e.target.value)} placeholder={field.placeholder||""}/>}
          {field.type==="check"&& <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 0"}}>
            <input type="checkbox" checked={!!f.subData[field.key]} onChange={e=>updateSub(field.key,e.target.checked)}/><span style={{fontSize:12}}>{f.subData[field.key]?"Completed":"Not done"}</span>
          </div>}
        </div>)}
      </div>
    </div>}

    {/* Narrative note with AI Expand button */}
    <div className="fi" style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <label style={{margin:0}}>Narrative Note</label>
        <button type="button" className="btn btn-sm" style={{background:"linear-gradient(135deg,#5b21b6,#7c3aed)",color:"#fff",fontSize:10,padding:"4px 10px"}} onClick={aiExpand} disabled={aiLoading}>
          {aiLoading?"⏳ AI Working...":"✨ AI Expand to Full Documentation"}
        </button>
      </div>
      <textarea rows={5} value={f.text} onChange={e=>sF({...f,text:e.target.value})} placeholder="Brief note (e.g. 'Becky had good day, ate lunch, walked'). Click ✨ AI Expand to convert to full clinical documentation."/>
      {aiError&&<div style={{fontSize:11,color:"var(--err)",marginTop:4}}>{aiError}</div>}
      <div style={{fontSize:10,color:"var(--t2)",marginTop:4}}>💡 Tip: Write 1-2 quick sentences, then AI will expand to professional clinical documentation.</div>
    </div>

    {/* Auto-summary of sub-data */}
    {Object.keys(f.subData).length>0&& <div style={{padding:10,background:"var(--bg)",marginBottom:12,fontSize:11,color:"var(--t2)",lineHeight:1.7}}>
      <strong>Tracked:</strong> {Object.entries(f.subData).filter(([_,v])=>v&&v!=="").map(([k,v])=>{
        const field=cat?.fields?.find(fl=>fl.key===k);
        return `${field?.label||k}: ${typeof v==="boolean"?(v?"✓":"✕"):v}`;
      }).join(" | ")}
    </div>}

    {/* Photo Documentation */}
    <div style={{padding:14,background:"var(--bg)",marginBottom:12,border:"1px dashed var(--bdr)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--t2)",margin:0}}>📸 Photo Documentation</label>
        <span style={{fontSize:10,color:"var(--t2)"}}>{(f.photos||[]).length} photo{(f.photos||[]).length===1?"":"s"} attached</span>
      </div>
      <div style={{fontSize:10,color:"var(--t2)",marginBottom:10}}>📱 Take photos to document tasks completed (meal prep, room cleaned, wound care, etc.). Photos are saved with the note.</div>
      
      {/* Photo grid */}
      {(f.photos||[]).length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:6,marginBottom:10}}>
        {f.photos.map(ph=><div key={ph.id} style={{position:"relative"}}>
          <img src={ph.url} alt="Task" style={{width:"100%",height:80,objectFit:"cover",border:"var(--border-thin)"}}/>
          <button type="button" onClick={()=>removePhoto(ph.id)} style={{position:"absolute",top:2,right:2,width:18,height:18,padding:0,border:"none",background:"rgba(0,0,0,.7)",color:"#fff",cursor:"pointer",fontSize:11,lineHeight:1}}>✕</button>
        </div>)}
      </div>}

      {/* Upload buttons */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <label className="btn btn-sm btn-p" style={{cursor:"pointer",display:"inline-flex",gap:4,alignItems:"center"}}>
          {uploadingPhoto?"⏳ Uploading...":"📷 Take Photo"}
          <input type="file" accept="image/*" capture="environment" style={{display:"none"}} disabled={uploadingPhoto} onChange={e=>{addPhoto(e.target.files[0]);e.target.value="";}}/>
        </label>
        <label className="btn btn-sm btn-s" style={{cursor:"pointer",display:"inline-flex",gap:4,alignItems:"center"}}>
          🖼 Upload from Gallery
          <input type="file" accept="image/*" style={{display:"none"}} disabled={uploadingPhoto} onChange={e=>{addPhoto(e.target.files[0]);e.target.value="";}}/>
        </label>
      </div>
    </div>

    <button className="btn btn-p" style={{width:"100%"}} onClick={()=>{
      const subSummary=Object.entries(f.subData).filter(([_,v])=>v&&v!=="").map(([k,v])=>{const fl=cat?.fields?.find(x=>x.key===k);return `${fl?.label||k}: ${typeof v==="boolean"?(v?"Completed":"Not done"):v}`;}).join(". ");
      const fullText=subSummary?(f.text?`${f.text}\n\n[${f.category}] ${subSummary}`:subSummary):f.text;
      if(fullText||(f.photos||[]).length>0) onSave({...f,text:fullText});
    }} disabled={(!f.text&&Object.keys(f.subData).filter(k=>f.subData[k]&&f.subData[k]!=="").length===0&&(f.photos||[]).length===0)||uploadingPhoto}>Save Note</button>
  </div>;
}

function IncidentForm({clients,caregivers,onSave}){
  const [f,sF]=useState({clientId:"CL1",caregiverId:"CG1",type:"Fall",severity:"low",description:"",followUp:"",familyNotified:false});
  return <div className="modal-b"><div className="fg" style={{marginBottom:12}}>
    <div className="fi"><label>Client</label><select value={f.clientId} onChange={e=>sF({...f,clientId:e.target.value})}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <div className="fi"><label>Caregiver</label><select value={f.caregiverId} onChange={e=>sF({...f,caregiverId:e.target.value})}>{caregivers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <div className="fi"><label>Type</label><select value={f.type} onChange={e=>sF({...f,type:e.target.value})}>{["Fall","Near Fall","Medication Issue","Emergency Call","Behavioral","Skin Integrity","Other"].map(t=><option key={t}>{t}</option>)}</select></div>
    <div className="fi"><label>Severity</label><select value={f.severity} onChange={e=>sF({...f,severity:e.target.value})}>{["low","medium","high","critical"].map(s=><option key={s}>{s}</option>)}</select></div>
  </div>
  <div className="fi" style={{marginBottom:12}}><label>Description</label><textarea rows={3} value={f.description} onChange={e=>sF({...f,description:e.target.value})} placeholder="Describe what happened..."/></div>
  <div className="fi" style={{marginBottom:12}}><label>Follow-up Plan</label><input value={f.followUp} onChange={e=>sF({...f,followUp:e.target.value})} placeholder="Required actions..."/></div>
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}><input type="checkbox" checked={f.familyNotified} onChange={e=>sF({...f,familyNotified:e.target.checked})}/><label style={{fontSize:13}}>Family has been notified</label></div>
  <button className="btn btn-er" onClick={()=>f.description&&onSave(f)} disabled={!f.description}>Submit Incident Report</button></div>;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPENSES
// ═══════════════════════════════════════════════════════════════════════
function ExpensesPage({expenses,setExpenses,caregivers,clients}){
  const pending=expenses.filter(e=>e.status==="pending");
  const approved=expenses.filter(e=>e.status==="approved");
  const [showAdd,setShowAdd]=useState(false);
  const [viewReceipt,setViewReceipt]=useState(null);
  const [f,sF]=useState({caregiverId:"CG1",clientId:"CL1",category:"Groceries",description:"",amount:0,receipt:false,gps:""});

  const submit=()=>{if(!f.description||f.amount<=0)return;setExpenses(p=>[{id:"EX"+uid(),date:today(),...f,status:"pending"},...p]);sF({caregiverId:"CG1",clientId:"CL1",category:"Groceries",description:"",amount:0,receipt:false,gps:""});setShowAdd(false);};

  return <div>
    <div className="hdr"><div><h2>Expenses</h2><div className="hdr-sub">Track, approve, and feed to client billing</div></div>
      <button className="btn btn-p btn-sm" onClick={()=>setShowAdd(!showAdd)}>+ Log Expense</button>
    </div>
    <div className="sg">
      <div className="sc wn"><span className="sl">Pending</span><span className="sv">{$(pending.reduce((s,e)=>s+e.amount,0))}</span><span className="ss">{pending.length} expenses</span></div>
      <div className="sc ok"><span className="sl">Approved</span><span className="sv">{$(approved.reduce((s,e)=>s+e.amount,0))}</span><span className="ss">{approved.length} expenses</span></div>
      <div className="sc bl"><span className="sl">Billable to Clients</span><span className="sv">{$(approved.filter(e=>["Groceries","Pharmacy","Supplies"].includes(e.category)).reduce((s,e)=>s+e.amount,0))}</span><span className="ss">Auto-feeds to invoices</span></div>
    </div>

    {showAdd&&<div className="card card-b"><div className="fg" style={{marginBottom:12}}>
      <div className="fi"><label>Caregiver</label><select value={f.caregiverId} onChange={e=>sF({...f,caregiverId:e.target.value})}>{caregivers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="fi"><label>Client</label><select value={f.clientId} onChange={e=>sF({...f,clientId:e.target.value})}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="fi"><label>Category</label><select value={f.category} onChange={e=>sF({...f,category:e.target.value})}>{["Groceries","Pharmacy","Supplies","Transportation","Mileage","Meals","Other"].map(c=><option key={c}>{c}</option>)}</select></div>
    </div><div className="fg" style={{marginBottom:12}}>
      <div className="fi" style={{flex:2}}><label>Description</label><input value={f.description} onChange={e=>sF({...f,description:e.target.value})} placeholder="What was purchased?"/></div>
      <div className="fi"><label>Amount</label><input type="number" value={f.amount||""} onChange={e=>sF({...f,amount:+e.target.value})} step="0.01"/></div>
      <div className="fi"><label>GPS Location</label><input value={f.gps} onChange={e=>sF({...f,gps:e.target.value})} placeholder="Store name & address"/></div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}><input type="checkbox" checked={f.receipt} onChange={e=>sF({...f,receipt:e.target.checked})}/><label style={{fontSize:13}}>Receipt photo captured</label></div>
    <div style={{display:"flex",gap:8}}><button className="btn btn-p" onClick={submit}>Submit</button><button className="btn btn-s" onClick={()=>setShowAdd(false)}>Cancel</button></div>
    </div>}

    <div className="card"><div className="card-h"><h3>All Expenses</h3></div>
      <div className="tw"><table><thead><tr><th>Date</th><th>Caregiver</th><th>Client</th><th>Category</th><th>Description</th><th style={{textAlign:"right"}}>Amount</th><th>Receipt</th><th>GPS</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {expenses.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>{const cg=caregivers.find(c=>c.id===e.caregiverId);const cl=clients.find(c=>c.id===e.clientId);
          return <tr key={e.id}><td>{fmtD(e.date)}</td><td>{cg?.name}</td><td style={{fontWeight:600}}>{cl?.name}</td>
            <td><span className="tag tag-bl">{e.category}</span></td><td>{e.description}</td>
            <td style={{textAlign:"right",fontWeight:700}}>{$(e.amount)}</td>
            <td>{e.receiptPhoto?<img src={e.receiptPhoto} alt="Receipt" style={{width:32,height:32,objectFit:"cover",cursor:"pointer",border:"var(--border-thin)"}} onClick={()=>setViewReceipt(e)}/>:e.receipt?<span style={{cursor:"pointer",fontSize:18}} title="Receipt indicated, no photo uploaded" onClick={()=>setViewReceipt({...e,noPhoto:true})}>📷</span>:"—"}</td>
            <td style={{fontSize:10,maxWidth:100}} title={e.gps}>{e.gps?`📍 ${e.gps.split(",")[0]}`:"—"}</td>
            <td><span className={`tag ${e.status==="approved"?"tag-ok":"tag-wn"}`}>{e.status}</span></td>
            <td>{e.status==="pending"&&<div style={{display:"flex",gap:4}}>
              <button className="btn btn-sm btn-ok" onClick={()=>setExpenses(p=>p.map(x=>x.id===e.id?{...x,status:"approved"}:x))}>✓</button>
              <button className="btn btn-sm btn-er" onClick={()=>setExpenses(p=>p.map(x=>x.id===e.id?{...x,status:"rejected"}:x))}>✕</button>
            </div>}</td></tr>;})}
      </tbody></table></div>
    </div>

    {/* Receipt Viewer Modal */}
    {viewReceipt&& <div className="modal-bg" onClick={()=>setViewReceipt(null)}>
      <div className="modal" style={{maxWidth:600,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
        <div className="modal-h">Receipt — {viewReceipt.description}<button className="btn btn-sm btn-s" onClick={()=>setViewReceipt(null)}>✕</button></div>
        <div className="modal-b" style={{textAlign:"center"}}>
          {viewReceipt.receiptPhoto?
            <img src={viewReceipt.receiptPhoto} alt="Receipt" style={{maxWidth:"100%",maxHeight:"60vh",border:"var(--border-thin)"}}/>
            :<div style={{padding:"40px 20px",background:"var(--bg)",border:"2px dashed var(--bdr)"}}><div style={{fontSize:40,marginBottom:8}}>📷</div><div style={{fontWeight:700}}>No Photo Uploaded</div><div style={{fontSize:11,color:"var(--t2)",marginTop:4}}>Caregiver indicated they have a receipt but didn't upload a photo. Ask them to forward it.</div></div>
          }
          <div style={{marginTop:12,padding:"10px 14px",background:"var(--bg)",fontSize:12,textAlign:"left"}}>
            {viewReceipt.receiptNote&&<div style={{marginBottom:6}}><strong>Receipt details:</strong> {viewReceipt.receiptNote}</div>}
            <div><strong>Caregiver:</strong> {caregivers.find(c=>c.id===viewReceipt.caregiverId)?.name}</div>
            <div><strong>Client:</strong> {clients.find(c=>c.id===viewReceipt.clientId)?.name}</div>
            <div><strong>Date:</strong> {fmtD(viewReceipt.date)} · <strong>Amount:</strong> ${viewReceipt.amount.toFixed(2)}</div>
            {viewReceipt.gps&&<div><strong>📍 GPS:</strong> {viewReceipt.gps}</div>}
          </div>
        </div>
      </div>
    </div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// TRAINING ACADEMY
// ═══════════════════════════════════════════════════════════════════════
function TrainingPage({caregivers,progress,setProgress,modal,setModal}){
  const [selMod,setSelMod]=useState(null);
  const [expandedLesson,setExpandedLesson]=useState(null);
  const [selCG,setSelCG]=useState("");

  return <div>
    <div className="hdr"><div><h2>Training Academy</h2><div className="hdr-sub">{TRAINING_MODULES.length} modules covering home care essentials</div></div></div>

    {/* Team Progress */}
    <div className="sg">{caregivers.map(cg=>{
      const done=(progress[cg.id]||[]).length;const pct=Math.round(done/TRAINING_MODULES.length*100);
      return <div key={cg.id} className="sc" style={{borderColor:pct===100?"var(--ok)":pct>=60?"var(--blue)":"var(--warn)"}}>
        <span className="sl">{cg.name}</span><span className="sv">{pct}%</span>
        <div className="progress-bar" style={{marginTop:6}}><div className="progress-fill" style={{width:`${pct}%`,background:pct===100?"var(--ok)":"var(--blue)"}}/></div>
        <span className="ss">{done}/{TRAINING_MODULES.length} complete</span>
      </div>;})}</div>

    {/* Module Grid */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
      {TRAINING_MODULES.map((mod,idx)=>{
        const completedBy=Object.entries(progress).filter(([_,arr])=>arr.includes(idx)).map(([cgId])=>caregivers.find(c=>c.id===cgId)?.name).filter(Boolean);
        const catColor={Compliance:"var(--purple)",Safety:"var(--err)",Clinical:"var(--blue)","Daily Living":"var(--ok)"}[mod.category]||"var(--blue)";
        return <div key={mod.id} className="card" style={{cursor:"pointer"}} onClick={()=>{setSelMod(idx);setExpandedLesson(null);}}>
          <div style={{padding:"16px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <span className="tag" style={{background:catColor+"20",color:catColor}}>{mod.category}</span>
              <span style={{fontSize:11,color:"var(--t2)"}}>{mod.duration}</span>
            </div>
            <div style={{fontFamily:"var(--fd)",fontSize:15,fontWeight:400,marginBottom:4}}>{mod.title}</div>
            <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.5,marginBottom:10}}>{mod.description.slice(0,100)}...</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",gap:-4}}>{completedBy.slice(0,4).map((name,i)=><div key={i} className="avatar" style={{width:24,height:24,fontSize:9,background:"#111",color:"#fff",marginLeft:i>0?-6:0,border:"2px solid #fff"}}>{name.split(" ").map(n=>n[0]).join("")}</div>)}</div>
              <span style={{fontSize:11,color:"var(--t2)"}}>{completedBy.length}/{caregivers.length} complete</span>
            </div>
          </div>
        </div>;
      })}
    </div>

    {/* Module Detail Modal */}
    {selMod!==null&&<div className="modal-bg" onClick={()=>setSelMod(null)}><div className="modal" style={{maxWidth:640}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">{TRAINING_MODULES[selMod].title}<button className="btn btn-sm btn-s" onClick={()=>setSelMod(null)}>✕</button></div>
      <div className="modal-b">
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          <span className="tag tag-bl">{TRAINING_MODULES[selMod].category}</span>
          <span className="tag tag-pu">{TRAINING_MODULES[selMod].duration}</span>
          <span className="tag tag-wn">{TRAINING_MODULES[selMod].difficulty}</span>
        </div>
        <p style={{fontSize:13,lineHeight:1.6,marginBottom:16}}>{TRAINING_MODULES[selMod].description}</p>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>Lessons</h4>
        {TRAINING_MODULES[selMod].lessons.map((l,i)=>{
          const isObj=typeof l==="object";
          const title=isObj?l.title:l;
          const content=isObj?l.content:null;
          const isOpen=expandedLesson===i;
          return <div key={i} style={{borderBottom:"1px solid var(--bdr)"}}>
            <div style={{padding:"8px 0",display:"flex",alignItems:"center",gap:10,cursor:content?"pointer":"default"}} onClick={()=>content&&setExpandedLesson(isOpen?null:i)}>
              <div style={{width:24,height:24,borderRadius:0,background:isOpen?"var(--blue)":"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:isOpen?"#fff":"var(--t2)",transition:"all .2s"}}>{i+1}</div>
              <span style={{fontSize:13,fontWeight:isOpen?700:400,flex:1}}>{title}</span>
              {content&&<span style={{fontSize:11,color:"var(--t2)"}}>{isOpen?"▼":"▶"}</span>}
            </div>
            {isOpen&&content&&<div style={{padding:"4px 0 14px 34px",fontSize:12,lineHeight:1.7,color:"var(--t1)",whiteSpace:"pre-line"}}>{content}</div>}
          </div>;
        })}
        {TRAINING_MODULES[selMod].quiz.length>0&&<><h4 style={{fontSize:13,fontWeight:700,margin:"16px 0 8px"}}>Quiz Preview</h4>
          {TRAINING_MODULES[selMod].quiz.map((q,i)=><div key={i} style={{padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>{q.q}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{q.opts.map((o,j)=><div key={j} style={{padding:"6px 10px",borderRadius:"var(--rs)",fontSize:12,background:j===q.a?"var(--ok-l)":"var(--bg)",border:j===q.a?"1px solid var(--ok)":"1px solid var(--bdr)"}}>{o}</div>)}</div>
          </div>)}</>}
        <h4 style={{fontSize:13,fontWeight:700,margin:"16px 0 8px"}}>Completion Status</h4>
        {caregivers.map(cg=>{const done=(progress[cg.id]||[]).includes(selMod);
          return <div key={cg.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--bdr)"}}>
            <span style={{fontSize:13,fontWeight:600}}>{cg.name}</span>
            {done?<span className="tag tag-ok">Complete</span>:<button className="btn btn-sm btn-p" onClick={()=>setProgress(p=>({...p,[cg.id]:[...(p[cg.id]||[]),selMod]}))}>Mark Complete</button>}
          </div>;})}
      </div>
    </div></div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// CLIENT PORTAL — Full interactive client-facing experience
// ═══════════════════════════════════════════════════════════════════════
function ClientPortalPage({clients,caregivers,notify,assignments,sel,setSel,serviceRequests,setServiceRequests,surveys,setSurveys,careGoals,vitals,setVitals,documents,careNotes,events,expenses,familyMsgs,setFamilyMsgs,notifications,onReferCG,onReferClient}){
  const cl=clients.find(c=>c.id===sel)||clients[0];
  const [tab,setTab]=useState("home");
  const [showRequest,setShowRequest]=useState(false);
  const [showSurvey,setShowSurvey]=useState(false);
  const [showVital,setShowVital]=useState(false);
  const [msgText,setMsgText]=useState("");

  // CLIENT-VISIBLE care notes: filter out sensitive clinical/admin categories
  // Hidden from client view: Cognitive, Emotional, Observations, Escalations, Incidents, Safety
  // (Visible: ADLs, IADLs, Nutrition, Elimination, Mobility, Routine, Transportation, General)
  const HIDDEN_FROM_CLIENT=["Cognitive","Emotional","Observations","Escalations","Incidents","Safety"];
  const clNotes=careNotes.filter(n=>n.clientId===cl.id&&!HIDDEN_FROM_CLIENT.includes(n.category)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const clEvents=events.filter(e=>e.clientId===cl.id && new Date(e.date)>=now()).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const clGoals=careGoals.filter(g=>g.clientId===cl.id);
  // Client alerts/notifications
  const clAlerts=(notifications||[]).filter(n=>n.to===cl.id||n.meta?.clientId===cl.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const activeLateAlert=clAlerts.find(n=>n.type==="running_late"&&(now()-new Date(n.date))<3600000);
  const clVitals=vitals.filter(v=>v.clientId===cl.id).sort((a,b)=>b.date.localeCompare(a.date));
  const clDocs=documents.filter(d=>d.clientId===cl.id);
  const clRequests=serviceRequests.filter(r=>r.clientId===cl.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const clSurveys=surveys.filter(s=>s.clientId===cl.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const clExpenses=expenses.filter(e=>e.clientId===cl.id && (e.status==="approved"||e.adminApproved));
  const clMsgs=familyMsgs.filter(m=>m.clientId===cl.id).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const assignedCGs=assignments?[...new Set(assignments.filter(a=>a.clientId===cl.id&&a.status==="active").map(a=>a.caregiverId))].map(id=>caregivers.find(c=>c.id===id)).filter(Boolean):[...new Set(clNotes.map(n=>n.caregiverId))].map(id=>caregivers.find(c=>c.id===id)).filter(Boolean);

  const sendMsg=()=>{if(!msgText.trim())return;setFamilyMsgs(p=>[...p,{id:"FM"+uid(),clientId:cl.id,from:cl.name,fromType:"family",date:now().toISOString(),text:msgText}]);if(notify)notify("U2","message","Client Message",`${cl.name}: ${msgText.slice(0,100)}`,{clientId:cl.id});setMsgText("");};

  const tabs=[
    {key:"home",label:"🏠 Home",show:true},
    {key:"alerts",label:"🔔 Alerts"+(clAlerts.filter(a=>!a.read).length>0?" ("+clAlerts.filter(a=>!a.read).length+")":""),show:true},
    {key:"schedule",label:"📅 Schedule",show:true},
    {key:"health",label:"❤️ Health",show:true},
    {key:"goals",label:"🎯 Goals",show:true},
    {key:"messages",label:"💬 Messages",show:true},
    {key:"requests",label:"📩 Requests",show:true},
    {key:"billing",label:"💰 Billing",show:true},
    {key:"documents",label:"📁 Documents",show:true},
    {key:"refer",label:"📣 Refer",show:true},
    {key:"feedback",label:"⭐ Feedback",show:true},
  ];

  return <div>
    {/* Portal Header */}
    <div style={{background:"#111",color:"#fff",borderRadius:"var(--r)",padding:"24px 28px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{display:"flex",gap:16,alignItems:"center"}}>
        <ProfileAvatar name={cl.name} photo={cl.photo} size={56} dark/>
        <div>
          <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1,opacity:.4,marginBottom:2}}>Client Portal</div>
          <div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:900}}>{cl.name}</div>
          <div style={{fontSize:12,opacity:.5,marginTop:2}}>{cl.addr}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <select value={sel} onChange={e=>setSel(e.target.value)} style={{padding:"8px 12px",borderRadius:"var(--rs)",border:"1px solid rgba(255,255,255,.15)",background:"rgba(255,255,255,.08)",color:"#fff",fontFamily:"var(--f)",fontWeight:600,fontSize:12}}>
          {clients.map(c=> <option key={c.id} value={c.id} style={{color:"#000"}}>{c.name}</option>)}
        </select>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:10,opacity:.4,textTransform:"uppercase"}}>Care Team</div>
          <div style={{display:"flex",gap:-4,marginTop:4}}>{assignedCGs.slice(0,3).map((cg,i)=> <ProfileAvatar key={cg.id} name={cg.name} photo={cg.photo} size={28} dark/>)}</div>
        </div>
      </div>
    </div>

    {/* Tab Bar */}
    <div className="tab-row" style={{overflowX:"auto",whiteSpace:"nowrap",paddingBottom:0}}>
      {tabs.filter(t=>t.show).map(t=> <button key={t.key} className={`tab-btn ${tab===t.key?"act":""}`} onClick={()=>setTab(t.key)}>{t.label}</button>)}
    </div>

    {/* ═══ HOME ═══ */}
    {tab==="home"&& <div>
      {/* Running Late Alert Banner */}
      {activeLateAlert&& <div style={{background:"linear-gradient(135deg,#6b4400,#8a5a00)",color:"#fff",padding:"16px 20px",marginBottom:14,display:"flex",gap:16,alignItems:"center",border:"2px solid #ffa94d"}}>
        <div style={{fontSize:32}}>⚠️</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Caregiver Running Late</div>
          <div style={{fontSize:13,lineHeight:1.5}}>{activeLateAlert.body}</div>
          <div style={{fontSize:11,opacity:.8,marginTop:4}}>Received {new Date(activeLateAlert.date).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:28,fontWeight:700}}>{activeLateAlert.meta?.eta||"?"}</div>
          <div style={{fontSize:10,textTransform:"uppercase"}}>min ETA</div>
        </div>
      </div>}

      {/* Welcome Card */}
      <div className="ai-card">
        <h4><span className="pulse" style={{background:"var(--ok)"}}/>Welcome, {cl.name.split(" ")[0]}</h4>
        <p>
          {clEvents.length>0?`Your next appointment is ${clEvents[0].title} on ${fmtD(clEvents[0].date)}. `:"No upcoming appointments. "}
          {clGoals.filter(g=>g.status==="at-risk").length>0?`${clGoals.filter(g=>g.status==="at-risk").length} care goal${clGoals.filter(g=>g.status==="at-risk").length>1?"s":""} need${clGoals.filter(g=>g.status==="at-risk").length===1?"s":""} attention. `:"All care goals on track! "}
          {clRequests.filter(r=>r.status==="pending").length>0?`You have ${clRequests.filter(r=>r.status==="pending").length} pending request${clRequests.filter(r=>r.status==="pending").length>1?"s":""}.`:""}
          Your care team is here for you. 💛
        </p>
      </div>

      <div className="sg">
        <div className="sc ok" style={{cursor:"pointer"}} onClick={()=>setTab("health")}><span className="sl">Last Vitals</span><span className="sv">{clVitals[0]?.bp||"—"}</span><span className="ss">{clVitals[0]?fmtD(clVitals[0].date):"No records"}</span></div>
        <div className="sc bl" style={{cursor:"pointer"}} onClick={()=>setTab("schedule")}><span className="sl">Next Event</span><span className="sv" style={{fontSize:16}}>{clEvents[0]?.title||"None"}</span><span className="ss">{clEvents[0]?fmtD(clEvents[0].date):""}</span></div>
        <div className="sc pu" style={{cursor:"pointer"}} onClick={()=>setTab("goals")}><span className="sl">Care Goals</span><span className="sv">{clGoals.filter(g=>g.status==="achieved").length}/{clGoals.length}</span><span className="ss">{clGoals.filter(g=>g.status==="at-risk").length} need attention</span></div>
        <div className="sc wn" style={{cursor:"pointer"}} onClick={()=>setTab("requests")}><span className="sl">Requests</span><span className="sv">{clRequests.filter(r=>r.status==="pending").length}</span><span className="ss">pending</span></div>
      </div>

      {/* Recent Care Notes */}
      <div className="card"><div className="card-h"><h3>Recent Care Updates</h3><button className="btn btn-sm btn-s" onClick={()=>setTab("messages")}>View All</button></div>
        {clNotes.slice(0,3).map(n=>{const cg=caregivers.find(c=>c.id===n.caregiverId);return <div key={n.id} style={{padding:"10px 18px",borderBottom:"1px solid var(--bdr)"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t2)",marginBottom:4}}><span style={{fontWeight:600}}>{cg?.name}</span><span>{fmtRel(n.date)}</span></div>
          <div style={{fontSize:13,lineHeight:1.6}}>{n.text}</div>
        </div>;})}
      </div>

      {/* Quick Actions */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        <button className="btn btn-p" style={{flexDirection:"column",padding:16,height:"auto",gap:8}} onClick={()=>{setTab("requests");setShowRequest(true);}}>📩<span>New Request</span></button>
        <button className="btn btn-s" style={{flexDirection:"column",padding:16,height:"auto",gap:8}} onClick={()=>setTab("messages")}>💬<span>Messages</span></button>
        <button className="btn btn-s" style={{flexDirection:"column",padding:16,height:"auto",gap:8}} onClick={()=>{setTab("feedback");setShowSurvey(true);}}>⭐<span>Give Feedback</span></button>
        <button className="btn btn-s" style={{flexDirection:"column",padding:16,height:"auto",gap:8}} onClick={()=>setTab("health")}>❤️<span>Vitals</span></button>
      </div>
    </div>}

    {/* ═══ ALERTS ═══ */}
    {tab==="alerts"&& <div>
      {activeLateAlert&& <div style={{background:"linear-gradient(135deg,#6b4400,#8a5a00)",color:"#fff",padding:"16px 20px",marginBottom:14,display:"flex",gap:16,alignItems:"center",border:"2px solid #ffa94d"}}>
        <div style={{fontSize:32}}>⚠️</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>ACTIVE: Caregiver Running Late</div>
          <div style={{fontSize:13,lineHeight:1.5}}>{activeLateAlert.body}</div>
        </div>
        <div style={{textAlign:"center"}}><div style={{fontSize:28,fontWeight:700}}>{activeLateAlert.meta?.eta||"?"}</div><div style={{fontSize:10,textTransform:"uppercase"}}>min ETA</div></div>
      </div>}
      <div className="card">
        <div className="card-h"><h3>All Alerts & Notifications</h3></div>
        {clAlerts.length===0&& <div className="empty">No alerts</div>}
        {clAlerts.map(a=><div key={a.id} style={{padding:"14px 20px",borderBottom:"var(--border-thin)",display:"flex",gap:14,alignItems:"flex-start",background:a.read?"transparent":"#fffbf0"}}>
          <div style={{fontSize:20,marginTop:2}}>
            {a.type==="running_late"?"⚠️":a.type==="clock_in"?"✅":a.type==="clock_out"?"👋":a.type==="incident"?"🚨":a.type==="schedule_change"?"📅":"🔔"}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>{a.title}</div>
            <div style={{fontSize:12,color:"var(--t2)",marginTop:2,lineHeight:1.5}}>{a.body}</div>
            <div style={{fontSize:10,color:"var(--t2)",marginTop:4}}>{new Date(a.date).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} at {new Date(a.date).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
          </div>
          {a.type==="running_late"&&a.meta?.eta&& <div style={{background:"#6b4400",color:"#fff",padding:"6px 12px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{a.meta.eta} min ETA</div>}
        </div>)}
      </div>
    </div>}

    {/* ═══ SCHEDULE ═══ */}
    {tab==="schedule"&& <div>
      <div className="card"><div className="card-h"><h3>Upcoming Events & Appointments</h3></div>
        {clEvents.length===0&& <div className="empty">No upcoming events scheduled</div>}
        {clEvents.map(ev=> <div key={ev.id} style={{padding:"14px 18px",borderBottom:"1px solid var(--bdr)",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{fontFamily:"var(--fd)",fontSize:15,fontWeight:400}}>{ev.title}</div>
            <div style={{fontSize:12,color:"var(--t2)",marginTop:2}}>{fmtD(ev.date)} at {fmtT(ev.date)}</div>
            {ev.notes&& <div style={{fontSize:12,color:"var(--t2)",marginTop:4,lineHeight:1.5}}>{ev.notes}</div>}
          </div>
          <span className={`tag ${ev.type==="medical"?"tag-er":"tag-bl"}`}>{ev.type}</span>
        </div>)}
      </div>
      <div className="card"><div className="card-h"><h3>My Care Team</h3></div>
        {assignedCGs.map(cg=> <div key={cg.id} style={{padding:"12px 18px",borderBottom:"1px solid var(--bdr)",display:"flex",gap:12,alignItems:"center"}}>
          <ProfileAvatar name={cg.name} photo={cg.photo} size={42} dark/>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{cg.name}</div><div style={{fontSize:12,color:"var(--t2)"}}>{cg.certs.join(", ")}</div></div>
          <div style={{fontSize:12,color:"var(--t2)"}}>{cg.phone}</div>
        </div>)}
      </div>
      <div className="card card-b">
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:8}}>My Preferences</h3>
        <div className="fg" style={{gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))"}}>
          {Object.entries(cl.preferences).map(([k,v])=> <div key={k}><div style={{fontSize:10,textTransform:"uppercase",color:"var(--t2)",fontWeight:600,marginBottom:3}}>{k.replace(/([A-Z])/g," $1")}</div><div style={{fontSize:13,fontWeight:600}}>{Array.isArray(v)?v.join(", "):v}</div></div>)}
        </div>
      </div>
    </div>}

    {/* ═══ HEALTH ═══ */}
    {tab==="health"&& <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h3 style={{fontFamily:"var(--fd)",fontSize:16}}>Health Dashboard</h3>
        <button className="btn btn-p btn-sm" onClick={()=>setShowVital(true)}>+ Record Vitals</button>
      </div>

      {/* Current Meds */}
      <div className="card"><div className="card-h"><h3>Current Medications</h3><span className="tag tag-bl">{cl.meds.length} active</span></div>
        <div className="card-b"><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
          {cl.meds.map((m,i)=> <div key={i} style={{padding:"10px 14px",background:"var(--bg)",borderRadius:"var(--rs)",fontSize:13,fontWeight:600,borderLeft:"3px solid var(--blue)"}}>{m}</div>)}
        </div></div>
      </div>

      {/* Vitals History */}
      <div className="card"><div className="card-h"><h3>Vitals History</h3></div>
        {clVitals.length===0? <div className="empty">No vitals recorded</div>:
        <div className="tw"><table><thead><tr><th>Date</th><th>Blood Pressure</th><th>Heart Rate</th><th>Temp</th>{clVitals.some(v=>v.glucose)&& <th>Glucose</th>}<th>Weight</th><th>Notes</th></tr></thead><tbody>
          {clVitals.map(v=> <tr key={v.id}>
            <td style={{fontWeight:600}}>{fmtD(v.date)}</td>
            <td><span style={{fontFamily:"var(--fd)",fontWeight:900,fontSize:15}}>{v.bp}</span></td>
            <td>{v.hr} bpm</td>
            <td>{v.temp}°F</td>
            {clVitals.some(vv=>vv.glucose)&& <td>{v.glucose||"—"} mg/dL</td>}
            <td>{v.weight} lbs</td>
            <td style={{fontSize:12,color:"var(--t2)",maxWidth:200}}>{v.notes||"—"}</td>
          </tr>)}
        </tbody></table></div>}
      </div>

      {/* Diagnoses & ADL */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div className="card"><div className="card-h"><h3>Diagnoses</h3></div><div className="card-b">
          {cl.dx.map((d,i)=> <div key={i} style={{padding:"6px 0",borderBottom:i<cl.dx.length-1?"1px solid var(--bdr)":"",fontSize:13}}><span className="tag tag-er" style={{marginRight:6}}>{i+1}</span>{d}</div>)}
        </div></div>
        <div className="card"><div className="card-h"><h3>Daily Living Status</h3></div><div className="card-b">
          {Object.entries(cl.adl).map(([k,v],i)=> <div key={k} style={{padding:"6px 0",borderBottom:i<Object.keys(cl.adl).length-1?"1px solid var(--bdr)":"",fontSize:13,display:"flex",justifyContent:"space-between"}}><span style={{textTransform:"capitalize",fontWeight:600}}>{k}</span><span style={{color:"var(--t2)",fontSize:11,textAlign:"right",maxWidth:"65%"}}>{v.split(" — ")[0]}</span></div>)}
        </div></div>
      </div>

      {/* Record Vital Modal */}
      {showVital&& <div className="modal-bg" onClick={()=>setShowVital(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">Record Vitals<button className="btn btn-sm btn-s" onClick={()=>setShowVital(false)}>✕</button></div>
        <VitalForm clientId={cl.id} onSave={v=>{setVitals(p=>[{id:"V"+uid(),...v},...p]);setShowVital(false);}}/>
      </div></div>}
    </div>}

    {/* ═══ GOALS ═══ */}
    {tab==="goals"&& <div>
      <div className="sg">
        <div className="sc ok"><span className="sl">Achieved</span><span className="sv">{clGoals.filter(g=>g.status==="achieved").length}</span></div>
        <div className="sc bl"><span className="sl">On Track</span><span className="sv">{clGoals.filter(g=>g.status==="on-track").length}</span></div>
        <div className="sc er"><span className="sl">At Risk</span><span className="sv">{clGoals.filter(g=>g.status==="at-risk").length}</span></div>
      </div>
      {clGoals.map(g=> <div key={g.id} className="card card-b" style={{borderLeft:`4px solid ${g.status==="achieved"?"var(--ok)":g.status==="on-track"?"var(--blue)":"var(--err)"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div><div style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:400}}>{g.title}</div><div style={{fontSize:12,color:"var(--t2)",marginTop:2}}>{g.category} • Target: {g.target}</div></div>
          <span className={`tag ${g.status==="achieved"?"tag-ok":g.status==="on-track"?"tag-bl":"tag-er"}`}>{g.status.replace("-"," ").toUpperCase()}</span>
        </div>
        <div className="progress-bar" style={{marginBottom:8}}><div className="progress-fill" style={{width:`${g.progress}%`,background:g.status==="achieved"?"var(--ok)":g.status==="on-track"?"var(--blue)":"var(--err)"}}/></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:"var(--t2)"}}>{g.notes}</span><span style={{fontWeight:700}}>{g.progress}%</span></div>
      </div>)}
      {clGoals.length===0&& <div className="card card-b empty">No care goals set yet</div>}
    </div>}

    {/* ═══ MESSAGES ═══ */}
    {tab==="messages"&& <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:14}}>
      {/* Care Notes Feed */}
      <div className="card"><div className="card-h"><h3>Care Updates from Your Team</h3></div>
        {clNotes.map(n=>{const cg=caregivers.find(c=>c.id===n.caregiverId);return <div key={n.id} style={{padding:"12px 18px",borderBottom:"1px solid var(--bdr)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}><ProfileAvatar name={cg?.name||"?"} photo={cg?.photo} size={28} dark/><span style={{fontWeight:600,fontSize:13}}>{cg?.name}</span></div>
            <span style={{fontSize:11,color:"var(--t2)"}}>{fmtD(n.date)} {fmtT(n.date)}</span>
          </div>
          <span className={`tag ${NOTE_CATS[n.category]?.color||"tag-ok"}`} style={{marginBottom:6,display:"inline-flex"}}>{n.category}</span>
          <div style={{fontSize:13,lineHeight:1.6,marginTop:4}}>{n.text}</div>
        </div>;})}
      </div>

      {/* Direct Messages */}
      <div className="card" style={{display:"flex",flexDirection:"column",maxHeight:"70vh"}}>
        <div className="card-h"><h3>💬 Direct Messages</h3></div>
        <div style={{flex:1,overflow:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:6}}>
          {clMsgs.map(m=> <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:m.from===cl.name?"flex-end":"flex-start"}}>
            <div className="chat-meta">{m.from} • {fmtRel(m.date)}</div>
            <div className={`chat-bubble ${m.from===cl.name?"chat-fam":"chat-cg"}`}>{m.text}</div>
          </div>)}
          {clMsgs.length===0&& <div className="empty" style={{padding:20}}>Start a conversation with your care team</div>}
        </div>
        <div style={{padding:"10px 14px",borderTop:"1px solid var(--bdr)",display:"flex",gap:8}}>
          <input value={msgText} onChange={e=>setMsgText(e.target.value)} placeholder="Message your care team..." style={{flex:1,padding:"8px 12px",border:"1px solid var(--bdr)",borderRadius:"var(--rs)",fontSize:13,fontFamily:"var(--f)"}} onKeyDown={e=>e.key==="Enter"&&sendMsg()}/>
          <button className="btn btn-p btn-sm" onClick={sendMsg} disabled={!msgText.trim()}>Send</button>
        </div>
      </div>
    </div>}

    {/* ═══ REQUESTS ═══ */}
    {tab==="requests"&& <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h3 style={{fontFamily:"var(--fd)",fontSize:16}}>Service Requests</h3>
        <button className="btn btn-p btn-sm" onClick={()=>setShowRequest(true)}>+ New Request</button>
      </div>
      {clRequests.map(r=> <div key={r.id} className="card card-b">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div><span className="tag tag-bl" style={{marginRight:8}}>{r.type}</span><span style={{fontSize:11,color:"var(--t2)"}}>{fmtD(r.date)}</span></div>
          <span className={`tag ${r.status==="pending"?"tag-wn":r.status==="approved"||r.status==="completed"||r.status==="acknowledged"?"tag-ok":"tag-er"}`}>{r.status.toUpperCase()}</span>
        </div>
        <div style={{fontSize:13,lineHeight:1.6,marginBottom:8}}>{r.description}</div>
        {r.response&& <div style={{padding:"10px 14px",background:"var(--ok-l)",borderRadius:"var(--rs)",fontSize:12,lineHeight:1.5,borderLeft:"3px solid var(--ok)"}}>
          <strong>Response:</strong> {r.response}<br/><span style={{fontSize:10,color:"var(--t2)"}}>{r.respondedAt?fmtD(r.respondedAt):""}</span>
        </div>}
      </div>)}
      {clRequests.length===0&& <div className="card card-b empty">No requests submitted yet</div>}

      {showRequest&& <div className="modal-bg" onClick={()=>setShowRequest(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">New Service Request<button className="btn btn-sm btn-s" onClick={()=>setShowRequest(false)}>✕</button></div>
        <RequestForm clientId={cl.id} onSave={r=>{setServiceRequests(p=>[{id:"SR"+uid(),clientId:cl.id,date:now().toISOString(),...r,status:"pending",response:"",respondedAt:""},...p]);setShowRequest(false);}}/>
      </div></div>}
    </div>}

    {/* ═══ BILLING ═══ */}
    {tab==="billing"&& <div>
      <div className="sg">
        <div className="sc bl"><span className="sl">Bill Rate</span><span className="sv">${cl.billRate}/hr</span></div>
        <div className="sc ok"><span className="sl">Approved Expenses</span><span className="sv">{$(clExpenses.reduce((s,e)=>s+e.amount,0))}</span><span className="ss">{clExpenses.length} items</span></div>
      </div>
      <div className="card"><div className="card-h"><h3>Expense Receipts (Billable)</h3></div>
        {clExpenses.length===0? <div className="empty">No approved expenses</div>:
        <div className="tw"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Receipt</th><th>Location</th><th style={{textAlign:"right"}}>Amount</th></tr></thead><tbody>
          {clExpenses.map(e=>{const cg=caregivers.find(c=>c.id===e.caregiverId);return <tr key={e.id}>
            <td>{fmtD(e.date)}</td>
            <td><span className="tag tag-bl">{e.category}</span></td>
            <td><div style={{fontWeight:600}}>{e.description}</div><div style={{fontSize:11,color:"var(--t2)"}}>by {cg?.name}</div></td>
            <td>{e.receipt?"📷 Yes":"—"}</td>
            <td style={{fontSize:11,color:"var(--t2)",maxWidth:120}} title={e.gps}>{e.gps?`📍 ${e.gps.split(",")[0]}`:"—"}</td>
            <td style={{textAlign:"right",fontWeight:700}}>{$(e.amount)}</td>
          </tr>;})}
          <tr style={{background:"#111",color:"#fff"}}><td colSpan={5} style={{fontWeight:700,borderBottom:"none"}}>Total Billable Expenses</td><td style={{textAlign:"right",fontWeight:900,fontFamily:"var(--fd)",fontSize:16,borderBottom:"none"}}>{$(clExpenses.reduce((s,e)=>s+e.amount,0))}</td></tr>
        </tbody></table></div>}
      </div>
    </div>}

    {/* ═══ DOCUMENTS ═══ */}
    {tab==="documents"&& <div>
      <div className="card"><div className="card-h"><h3>My Documents</h3></div>
        {clDocs.map(d=> <div key={d.id} style={{padding:"12px 18px",borderBottom:"1px solid var(--bdr)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{width:40,height:40,borderRadius:"var(--rs)",background:d.type==="care_plan"?"var(--blue-l)":d.type==="medical"?"var(--err-l)":"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
              {d.type==="care_plan"?"📋":d.type==="medical"?"🏥":"📝"}
            </div>
            <div><div style={{fontWeight:600,fontSize:13}}>{d.name}</div><div style={{fontSize:11,color:"var(--t2)"}}>{d.size} • {fmtD(d.date)}</div></div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <span className="tag tag-bl">{d.type.replace("_"," ")}</span>
            <button className="btn btn-sm btn-s">📥 View</button>
          </div>
        </div>)}
      </div>
    </div>}

    {/* ═══ REFER ═══ */}
    {tab==="refer"&& <ReferralForm referrerName={cl.name} referrerRole="Client" onReferCG={onReferCG} onReferClient={onReferClient}/>}

    {/* ═══ FEEDBACK ═══ */}
    {tab==="feedback"&& <div>
      <div className="ai-card"><h4>💛 Your Voice Matters</h4><p>Your feedback helps us improve your care. Rate your caregivers, submit suggestions, report concerns, or share a testimonial. All feedback is reviewed by our care team within 24 hours.</p></div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h3 style={{fontFamily:"var(--fd)",fontSize:16}}>Satisfaction & Feedback</h3>
        <div style={{display:"flex",gap:6}}>
          <button className="btn btn-p btn-sm" onClick={()=>setShowSurvey(true)}>⭐ Rate Caregiver</button>
        </div>
      </div>

      {/* Quick Feedback Cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
        {[
          {icon:"💡",label:"Suggestion",desc:"Ideas to improve your care",color:"#3c4f3d"},
          {icon:"⚠️",label:"Concern",desc:"Something that needs attention",color:"#6b4400"},
          {icon:"💛",label:"Testimonial",desc:"Share what you love about CWIN",color:"#8a7356"},
        ].map(item=><div key={item.label} style={{padding:"16px",background:"var(--card)",border:"var(--border-thin)",cursor:"pointer",textAlign:"center"}} onClick={()=>{
          const text=prompt(item.label+": Please share your "+item.label.toLowerCase()+"...");
          if(text&&text.trim()){
            setSurveys(p=>[{id:"FB"+uid(),clientId:cl.id,date:today(),type:item.label.toLowerCase(),ratings:{},comments:text,caregiver:""},...p]);
            if(notify)notify("U1","message","Client "+item.label+": "+cl.name,text.slice(0,200),{clientId:cl.id,type:item.label.toLowerCase()});
          }
        }}>
          <div style={{fontSize:28,marginBottom:6}}>{item.icon}</div>
          <div style={{fontWeight:700,fontSize:13}}>{item.label}</div>
          <div style={{fontSize:10,color:"var(--t2)",marginTop:2}}>{item.desc}</div>
        </div>)}
      </div>

      {/* Average Ratings */}
      {clSurveys.filter(s=>s.ratings?.overall).length>0&& <div className="card card-b">
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:12}}>Your Average Ratings</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
          {["overall","punctuality","communication","skills","respect","reliability"].map(k=>{
            const rated=clSurveys.filter(s=>s.ratings?.[k]);
            const avg=rated.length>0?rated.reduce((s,sv)=>s+(sv.ratings[k]||0),0)/rated.length:0;
            return <div key={k} style={{textAlign:"center",padding:"12px 8px",background:"var(--bg)"}}>
              <div style={{fontFamily:"var(--fd)",fontSize:24,fontWeight:900,color:avg>=4.5?"var(--ok)":avg>=3.5?"var(--blue)":"var(--warn)"}}>{avg>0?avg.toFixed(1):"—"}</div>
              <div style={{fontSize:10,textTransform:"uppercase",color:"var(--t2)",fontWeight:600,marginTop:2}}>{k}</div>
              <div style={{fontSize:14,marginTop:2}}>{avg>0?"★".repeat(Math.round(avg))+"☆".repeat(5-Math.round(avg)):""}</div>
            </div>;
          })}
        </div>
      </div>}

      {/* Feedback History */}
      <div className="card">
        <div className="card-h"><h3>Feedback History ({clSurveys.length})</h3></div>
        {clSurveys.length===0&&<div className="empty">No feedback submitted yet. Your feedback helps us provide better care!</div>}
        {clSurveys.map(sv=>{const cg=caregivers.find(c=>c.id===sv.caregiver);const isSurvey=sv.ratings?.overall;const feedbackType=sv.type||"survey";return <div key={sv.id} style={{padding:"14px 20px",borderBottom:"var(--border-thin)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:18}}>{feedbackType==="suggestion"?"💡":feedbackType==="concern"?"⚠️":feedbackType==="testimonial"?"💛":"⭐"}</span>
              <div>
                <span style={{fontWeight:700,fontSize:13}}>{isSurvey?"Caregiver Rating":"" }{feedbackType!=="survey"?feedbackType.charAt(0).toUpperCase()+feedbackType.slice(1):""}</span>
                {cg&&<span style={{fontSize:12,color:"var(--t2)",marginLeft:8}}>for {cg.name}</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {isSurvey&&<span style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:900,color:"var(--ok)"}}>{sv.ratings.overall}/5</span>}
              <span style={{fontSize:11,color:"var(--t2)"}}>{fmtD(sv.date)}</span>
            </div>
          </div>
          {isSurvey&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
            {Object.entries(sv.ratings).filter(([k])=>k!=="overall").map(([k,v])=> <span key={k} className={`tag ${v>=4?"tag-ok":v>=3?"tag-bl":"tag-wn"}`}>{k}: {v}/5</span>)}
          </div>}
          {sv.comments&& <div style={{fontSize:13,lineHeight:1.6,padding:"10px 14px",background:"var(--bg)",fontStyle:feedbackType==="testimonial"?"italic":"normal"}}>
            {feedbackType==="testimonial"?'"':""}
            {sv.comments}
            {feedbackType==="testimonial"?'"':""}
          </div>}
        </div>;})}
      </div>

      {showSurvey&& <div className="modal-bg" onClick={()=>setShowSurvey(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">⭐ Rate Your Care<button className="btn btn-sm btn-s" onClick={()=>setShowSurvey(false)}>✕</button></div>
        <SurveyForm clientId={cl.id} caregivers={assignedCGs} onSave={sv=>{setSurveys(p=>[{id:"SV"+uid(),clientId:cl.id,date:today(),...sv},...p]);setShowSurvey(false);if(notify)notify("U1","message","New Survey from "+cl.name,"Overall: "+sv.ratings.overall+"/5. "+sv.comments,{clientId:cl.id});}}/>
      </div></div>}
    </div>}
  </div>;
}

// ─── CLIENT PORTAL FORM COMPONENTS ──────────────────────────────────
function RequestForm({clientId,onSave}){
  const [f,sF]=useState({type:"Schedule Change",description:""});
  const types=["Schedule Change","Supply Request","Caregiver Feedback","Concern","Extra Visit","Other"];
  return <div className="modal-b">
    <div className="fi" style={{marginBottom:14}}><label>Request Type</label>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
        {types.map(t=> <div key={t} onClick={()=>sF({...f,type:t})} style={{padding:"10px 8px",borderRadius:"var(--rs)",border:`1.5px solid ${f.type===t?"#111":"var(--bdr)"}`,background:f.type===t?"#111":"var(--card)",color:f.type===t?"#fff":"var(--text)",textAlign:"center",fontSize:12,fontWeight:600,cursor:"pointer",transition:".15s"}}>{t}</div>)}
      </div>
    </div>
    <div className="fi" style={{marginBottom:14}}><label>Details</label><textarea rows={4} value={f.description} onChange={e=>sF({...f,description:e.target.value})} placeholder="Describe your request..."/></div>
    <button className="btn btn-p" onClick={()=>f.description&&onSave(f)} disabled={!f.description}>Submit Request</button>
  </div>;
}

function SurveyForm({clientId,caregivers,onSave}){
  const [f,sF]=useState({caregiver:caregivers[0]?.id||"",ratings:{overall:5,punctuality:5,communication:5,skills:5,respect:5,reliability:5},comments:""});
  const setR=(k,v)=>sF(p=>({...p,ratings:{...p.ratings,[k]:v}}));
  const stars=(key)=> <div style={{display:"flex",gap:4}}>
    {[1,2,3,4,5].map(v=> <span key={v} onClick={()=>setR(key,v)} style={{fontSize:22,cursor:"pointer",color:v<=f.ratings[key]?"#F5A623":"var(--bdr)"}}>{v<=f.ratings[key]?"★":"☆"}</span>)}
  </div>;

  return <div className="modal-b">
    <div className="fi" style={{marginBottom:14}}><label>Caregiver</label>
      <select value={f.caregiver} onChange={e=>sF({...f,caregiver:e.target.value})}>
        {caregivers.map(cg=> <option key={cg.id} value={cg.id}>{cg.name}</option>)}
      </select>
    </div>
    {["overall","punctuality","communication","skills","respect","reliability"].map(k=> <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--bdr)"}}>
      <span style={{fontSize:13,fontWeight:600,textTransform:"capitalize"}}>{k}</span>{stars(k)}
    </div>)}
    <div className="fi" style={{marginTop:14,marginBottom:14}}><label>Comments (optional)</label><textarea rows={3} value={f.comments} onChange={e=>sF({...f,comments:e.target.value})} placeholder="Tell us about your experience..."/></div>
    <button className="btn btn-p" onClick={()=>onSave(f)}>Submit Feedback</button>
  </div>;
}

function VitalForm({clientId,onSave}){
  const [f,sF]=useState({clientId,date:today(),bp:"",hr:"",temp:"",glucose:"",weight:"",notes:"",recordedBy:"Self"});
  return <div className="modal-b">
    <div className="fg" style={{marginBottom:12}}>
      <div className="fi"><label>Date</label><input type="date" value={f.date} onChange={e=>sF({...f,date:e.target.value})}/></div>
      <div className="fi"><label>Blood Pressure</label><input value={f.bp} onChange={e=>sF({...f,bp:e.target.value})} placeholder="e.g. 120/80"/></div>
      <div className="fi"><label>Heart Rate (bpm)</label><input type="number" value={f.hr} onChange={e=>sF({...f,hr:e.target.value})} placeholder="72"/></div>
      <div className="fi"><label>Temperature (°F)</label><input value={f.temp} onChange={e=>sF({...f,temp:e.target.value})} placeholder="98.6"/></div>
      <div className="fi"><label>Blood Glucose (mg/dL)</label><input type="number" value={f.glucose} onChange={e=>sF({...f,glucose:e.target.value})} placeholder="Optional"/></div>
      <div className="fi"><label>Weight (lbs)</label><input type="number" value={f.weight} onChange={e=>sF({...f,weight:e.target.value})} placeholder="Optional"/></div>
    </div>
    <div className="fi" style={{marginBottom:14}}><label>Notes</label><input value={f.notes} onChange={e=>sF({...f,notes:e.target.value})} placeholder="How are you feeling today?"/></div>
    <button className="btn btn-p" onClick={()=>f.bp&&onSave({...f,hr:Number(f.hr)||null,glucose:f.glucose?Number(f.glucose):null,weight:f.weight?Number(f.weight):null})}>Save Vitals</button>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// EVENTS & WELLNESS
// ═══════════════════════════════════════════════════════════════════════
function EventsPage({events,setEvents,clients}){
  const upcoming=events.filter(e=>new Date(e.date)>=now()).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const past=events.filter(e=>new Date(e.date)<now());

  return <div>
    <div className="hdr"><div><h2>Events & Wellness</h2><div className="hdr-sub">Medical appointments, social activities, and AI-suggested events</div></div></div>

    <div className="ai-card">
      <h4><span className="pulse" style={{background:"#7B61FF"}}/>AI Event Suggestions</h4>
      <p>Based on client interests and local events: 🎬 Casablanca at Music Box Theatre (Mar 21) for Linda. ⚾ Cubs Opening Day Watch Party (Mar 26) for Steven. 🎵 Free CSO concert series starts in June for Becky. 🃏 Lincoln Park Bridge Club meets Wednesdays for Becky.</p>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div className="card"><div className="card-h"><h3>Upcoming ({upcoming.length})</h3></div>
        {upcoming.map(ev=>{const cl=clients.find(c=>c.id===ev.clientId);const isAI=ev.notes?.includes("AI-suggested");
          return <div key={ev.id} style={{padding:"12px 18px",borderBottom:"1px solid var(--bdr)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div><div style={{fontWeight:700,fontSize:14}}>{ev.title}</div><div style={{fontSize:12,color:"var(--t2)",marginTop:2}}>{cl?.name} • {fmtD(ev.date)}</div></div>
              <div style={{display:"flex",gap:4}}><span className={`tag ${ev.type==="medical"?"tag-er":"tag-bl"}`}>{ev.type}</span>{isAI&&<span className="tag tag-pu">AI</span>}</div>
            </div>
            {ev.notes&&<div style={{fontSize:12,color:"var(--t2)",marginTop:6,lineHeight:1.5}}>{ev.notes}</div>}
          </div>;})}
      </div>
      <div className="card"><div className="card-h"><h3>Client Wellness Overview</h3></div>
        {clients.map(cl=>{const clEvents=events.filter(e=>e.clientId===cl.id);const medical=clEvents.filter(e=>e.type==="medical").length;const social=clEvents.filter(e=>e.type==="social").length;
          return <div key={cl.id} style={{padding:"12px 18px",borderBottom:"1px solid var(--bdr)"}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{cl.name}</div>
            <div style={{display:"flex",gap:8}}>
              <span className="tag tag-er">{medical} medical</span>
              <span className="tag tag-bl">{social} social</span>
            </div>
            <div style={{fontSize:11,color:"var(--t2)",marginTop:4}}>Interests: {cl.social.interests.slice(0,3).join(", ")}</div>
          </div>;})}
      </div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// FAMILY PORTAL
// ═══════════════════════════════════════════════════════════════════════
function FamilyPage({clients,familyMsgs,setFamilyMsgs,careNotes,incidents,events}){
  const [selClient,setSelClient]=useState("CL2");
  const [msg,setMsg]=useState("");
  const cl=clients.find(c=>c.id===selClient);
  const msgs=familyMsgs.filter(m=>m.clientId===selClient).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const contacts=cl?.familyPortal?.contacts||[];
  const clNotes=careNotes.filter(n=>n.clientId===selClient).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  const clInc=incidents.filter(i=>i.clientId===selClient&&i.familyNotified);
  const clEvents=events.filter(e=>e.clientId===selClient&&new Date(e.date)>=now());

  const sendMsg=()=>{if(!msg.trim())return;setFamilyMsgs(p=>[...p,{id:"FM"+uid(),clientId:selClient,from:"CWIN Care Team",fromType:"caregiver",date:now().toISOString(),text:msg}]);setMsg("");};

  return <div>
    <div className="hdr"><div><h2>Family Portal</h2><div className="hdr-sub">Secure communication and updates for authorized family members</div></div>
      <select value={selClient} onChange={e=>setSelClient(e.target.value)} style={{padding:"8px 12px",borderRadius:"var(--rs)",border:"1px solid var(--bdr)",fontFamily:"var(--f)",fontWeight:600}}>
        {clients.filter(c=>c.familyPortal?.enabled).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:14}}>
      <div>
        {/* Authorized Contacts */}
        <div className="card"><div className="card-h"><h3>Authorized Family Contacts</h3></div>
          {contacts.map((fc,i)=><div key={i} style={{padding:"10px 18px",borderBottom:"1px solid var(--bdr)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:600,fontSize:13}}>{fc.name}</div><div style={{fontSize:11,color:"var(--t2)"}}>{fc.relation} • {fc.email}</div></div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{fc.access.map(a=><span key={a} className="tag tag-bl" style={{fontSize:9}}>{a.replace(/_/g," ")}</span>)}</div>
          </div>)}
        </div>

        {/* Shared Care Notes */}
        <div className="card"><div className="card-h"><h3>Recent Care Updates</h3><span className="tag tag-ok">Shared</span></div>
          {clNotes.map(n=>{const cg=CAREGIVERS.find(c=>c.id===n.caregiverId);return <div key={n.id} style={{padding:"10px 18px",borderBottom:"1px solid var(--bdr)"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t2)",marginBottom:3}}><span>{cg?.name}</span><span>{fmtD(n.date)}</span></div>
            <div style={{fontSize:13,lineHeight:1.5}}>{n.text}</div>
          </div>;})}
        </div>

        {/* Upcoming Events */}
        {clEvents.length>0&&<div className="card"><div className="card-h"><h3>Upcoming Events</h3></div>
          {clEvents.map(ev=><div key={ev.id} style={{padding:"10px 18px",borderBottom:"1px solid var(--bdr)",display:"flex",justifyContent:"space-between"}}>
            <div><div style={{fontWeight:600,fontSize:13}}>{ev.title}</div><div style={{fontSize:11,color:"var(--t2)"}}>{fmtD(ev.date)}</div></div>
            <span className={`tag ${ev.type==="medical"?"tag-er":"tag-bl"}`}>{ev.type}</span>
          </div>)}
        </div>}
      </div>

      {/* Message Thread */}
      <div className="card" style={{display:"flex",flexDirection:"column",maxHeight:"70vh"}}>
        <div className="card-h"><h3>💬 Messages</h3></div>
        <div style={{flex:1,overflow:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:4}}>
          {msgs.map(m=><div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:m.fromType==="family"?"flex-end":"flex-start"}}>
            <div className="chat-meta">{m.from} • {fmtRel(m.date)}</div>
            <div className={`chat-bubble ${m.fromType==="family"?"chat-fam":"chat-cg"}`}>{m.text}</div>
          </div>)}
          {msgs.length===0&&<div className="empty">No messages yet</div>}
        </div>
        <div style={{padding:"10px 14px",borderTop:"1px solid var(--bdr)",display:"flex",gap:8}}>
          <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Type a message to family..." style={{flex:1,padding:"8px 12px",border:"1px solid var(--bdr)",borderRadius:"var(--rs)",fontSize:13,fontFamily:"var(--f)"}} onKeyDown={e=>e.key==="Enter"&&sendMsg()}/>
          <button className="btn btn-p btn-sm" onClick={sendMsg} disabled={!msg.trim()}>Send</button>
        </div>
      </div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// TEAM
// ═══════════════════════════════════════════════════════════════════════
function TeamPage({caregivers,setCaregivers,progress,clients,assignments,setAssignments}){
  const [manageCG,setManageCG] = useState(null);
  const activeClients=(clients||[]).filter(c=>c.status!=="archived");
  const getAssignedClients=(cgId)=>assignments.filter(a=>a.caregiverId===cgId&&a.status==="active").map(a=>a.clientId);
  const toggleAssign=(cgId,clId)=>{
    const exists=assignments.find(a=>a.caregiverId===cgId&&a.clientId===clId&&a.status==="active");
    if(exists){
      // Deactivate assignment
      setAssignments(p=>p.map(a=>(a.caregiverId===cgId&&a.clientId===clId&&a.status==="active")?{...a,status:"inactive",endDate:new Date().toISOString().slice(0,10)}:a));
    }else{
      // Check if an inactive one exists, reactivate, else create new
      const inactive=assignments.find(a=>a.caregiverId===cgId&&a.clientId===clId&&a.status!=="active");
      if(inactive){
        setAssignments(p=>p.map(a=>(a.caregiverId===cgId&&a.clientId===clId)?{...a,status:"active",startDate:new Date().toISOString().slice(0,10)}:a));
      }else{
        setAssignments(p=>[...p,{caregiverId:cgId,clientId:clId,status:"active",startDate:new Date().toISOString().slice(0,10)}]);
      }
    }
  };

  return <div>
    <div className="hdr"><div><h2>Team</h2><div className="hdr-sub">{caregivers.length} active caregivers · {assignments.filter(a=>a.status==="active").length} active assignments</div></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
      {caregivers.map(cg=>{const done=(progress[cg.id]||[]).length;const pct=Math.round(done/TRAINING_MODULES.length*100);
        const assignedIds=getAssignedClients(cg.id);
        const assignedClientNames=assignedIds.map(id=>clients.find(c=>c.id===id)).filter(Boolean);
        return <div key={cg.id} className="card card-b">
          <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:14}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <ProfileAvatar name={cg.name} photo={cg.photo} size={56} dark/>
              <PhotoUpload currentPhoto={cg.photo} onUpload={url=>setCaregivers(p=>p.map(c=>c.id===cg.id?{...c,photo:url}:c))} entityType="caregiver" entityId={cg.id} compact/>
            </div>
            <div style={{flex:1}}><div style={{fontFamily:"var(--fd)",fontSize:17,fontWeight:400}}>{cg.name}</div><div style={{fontSize:12,color:"var(--t2)"}}>{cg.email}</div><div style={{fontSize:12,color:"var(--t2)"}}>{cg.phone}</div></div>
            <span className="tag tag-ok">Active</span>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>{(cg.certs||[]).map(c=><span key={c} className="tag tag-bl">{c}</span>)}</div>

          {/* ASSIGNMENTS */}
          <div style={{padding:"10px 12px",background:"var(--bg)",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:"var(--t2)"}}>👥 Assigned Clients ({assignedIds.length})</div>
              <button className="btn btn-sm btn-p" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>setManageCG(cg)}>Manage</button>
            </div>
            {assignedClientNames.length>0?
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{assignedClientNames.map(cl=><span key={cl.id} className="tag tag-ok" style={{fontSize:10}}>{cl.name}</span>)}</div>
              :<div style={{fontSize:11,color:"var(--t2)",fontStyle:"italic"}}>No clients assigned</div>
            }
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:11,color:"var(--t2)"}}>Training: {done}/{TRAINING_MODULES.length}</span><span style={{fontSize:12,fontWeight:700}}>{pct}%</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{width:`${pct}%`,background:pct===100?"var(--ok)":"var(--blue)"}}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>
            <div style={{background:"var(--bg)",borderRadius:"var(--rs)",padding:10}}><div style={{fontSize:10,color:"var(--t2)",textTransform:"uppercase"}}>Rate</div><div style={{fontWeight:700}}>${cg.rate}/hr</div></div>
            <div style={{background:"var(--bg)",borderRadius:"var(--rs)",padding:10}}><div style={{fontSize:10,color:"var(--t2)",textTransform:"uppercase"}}>Since</div><div style={{fontWeight:700}}>{fmtD(cg.hireDate)}</div></div>
          </div>
        </div>;})}
    </div>

    {/* ═══ MANAGE ASSIGNMENTS MODAL ═══ */}
    {manageCG&&<div className="modal-bg" onClick={()=>setManageCG(null)}>
      <div className="modal" style={{maxWidth:500,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
        <div className="modal-h">👥 Manage Assignments — {manageCG.name}<button className="btn btn-sm btn-s" onClick={()=>setManageCG(null)}>✕</button></div>
        <div className="modal-b">
          <div className="ai-card"><h4>Client Assignments</h4><p>Check the clients this caregiver is assigned to. They'll show up in the caregiver's "My Clients" list, be schedulable, and appear in their portal.</p></div>
          <div style={{marginBottom:10,fontSize:12,color:"var(--t2)"}}>
            <strong>{getAssignedClients(manageCG.id).length}</strong> of <strong>{activeClients.length}</strong> clients assigned
          </div>
          {activeClients.length===0&&<div className="empty">No active clients to assign</div>}
          {activeClients.map(cl=>{const isAssigned=getAssignedClients(manageCG.id).includes(cl.id);return <div key={cl.id} onClick={()=>toggleAssign(manageCG.id,cl.id)} style={{padding:"12px 14px",borderBottom:"var(--border-thin)",display:"flex",gap:12,alignItems:"center",cursor:"pointer",background:isAssigned?"#f0fff0":"transparent"}}>
            <div style={{width:22,height:22,border:"2px solid "+(isAssigned?"var(--ok)":"#ccc"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"var(--ok)",fontWeight:700,flexShrink:0}}>{isAssigned?"✓":""}</div>
            <ProfileAvatar name={cl.name} photo={cl.photo} size={32}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13}}>{cl.name}</div>
              <div style={{fontSize:11,color:"var(--t2)"}}>{cl.age} years · {cl.dx?.slice(0,2).join(", ")||"No diagnoses listed"}</div>
            </div>
            {isAssigned&&<span className="tag tag-ok" style={{fontSize:10}}>Active</span>}
          </div>;})}
          <div style={{marginTop:14,padding:"10px 14px",background:"var(--bg)",fontSize:11,color:"var(--t2)"}}>
            💡 Tip: Caregivers can be assigned to multiple clients. Schedules, care notes, and client portal access auto-update based on these assignments.
          </div>
          <button className="btn btn-p" style={{width:"100%",marginTop:14}} onClick={()=>setManageCG(null)}>Done</button>
        </div>
      </div>
    </div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// RECONCILIATION CENTER — Drillable & Actionable
// ═══════════════════════════════════════════════════════════════════════
function ReconPage({entries,caregivers,clients}){
  const [sel,setSel]=useState(null);
  const [filter,setFilter]=useState("all");
  const filtered=filter==="all"?entries:entries.filter(e=>e.status===filter);
  const totalVar=entries.reduce((s,e)=>s+e.variance,0);
  const totalBilled=entries.reduce((s,e)=>s+e.billedAmount,0);
  const totalPaid=entries.reduce((s,e)=>s+e.paidAmount,0);
  const flagCount=entries.filter(e=>e.flags.length>0).length;
  const gpsMismatch=entries.filter(e=>!e.gpsMatch).length;

  return <div>
    <div className="hdr"><div><h2>Reconciliation Center</h2><div className="hdr-sub">Drill into time, GPS, and cost variances</div></div></div>

    <div className="sg">
      <div className="sc" style={{borderColor:totalVar<0?"var(--err)":"var(--ok)"}}><span className="sl">Time Variance</span><span className="sv" style={{color:totalVar<0?"var(--err)":"var(--ok)"}}>{totalVar.toFixed(1)}h</span><span className="ss">{totalVar<0?"Under":"Over"} scheduled</span></div>
      <div className="sc bl"><span className="sl">Total Billed</span><span className="sv">{$(totalBilled)}</span><span className="ss">{entries.length} entries</span></div>
      <div className="sc ok"><span className="sl">Total Paid</span><span className="sv">{$(totalPaid)}</span><span className="ss">Margin: {$(totalBilled-totalPaid)}</span></div>
      <div className="sc er"><span className="sl">Flags</span><span className="sv">{flagCount}</span><span className="ss">{gpsMismatch} GPS mismatches</span></div>
    </div>

    {/* AI Analysis */}
    <div className="ai-card">
      <h4><span className="pulse" style={{background:"var(--warn)"}}/>AI Reconciliation Analysis</h4>
      <p>
        {entries.filter(e=>e.flags.includes("LATE_ARRIVAL")).length} late arrivals detected.
        {gpsMismatch>0&&` ${gpsMismatch} GPS mismatch${gpsMismatch>1?"es":""} — clock-out location differs from client address.`}
        {entries.filter(e=>e.flags.includes("SHORT_SHIFT")).length>0&&` ${entries.filter(e=>e.flags.includes("SHORT_SHIFT")).length} shifts significantly shorter than scheduled.`}
        {entries.filter(e=>e.flags.includes("ADMIN_EDITED")).length>0&&` ${entries.filter(e=>e.flags.includes("ADMIN_EDITED")).length} entries manually edited by admin.`}
        {" "}Recommendation: Review flagged entries and confirm with caregivers before finalizing payroll.
      </p>
    </div>

    {/* Filter */}
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {["all","approved","review","flagged"].map(f=> <button key={f} className={`btn btn-sm ${filter===f?"btn-p":"btn-s"}`} onClick={()=>setFilter(f)}>{f==="all"?`All (${entries.length})`:f==="approved"?`Approved (${entries.filter(e=>e.status==="approved").length})`:f==="review"?`Review (${entries.filter(e=>e.status==="review").length})`:`Flagged (${entries.filter(e=>e.status==="flagged").length})`}</button>)}
    </div>

    <div className="card"><div className="tw"><table><thead><tr><th>Date</th><th>Caregiver</th><th>Client</th><th>Scheduled</th><th>Actual</th><th style={{textAlign:"right"}}>Variance</th><th>GPS</th><th>Flags</th><th style={{textAlign:"right"}}>Billed</th><th style={{textAlign:"right"}}>Paid</th><th style={{textAlign:"right"}}>Margin</th><th>Status</th><th></th></tr></thead><tbody>
      {filtered.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>{const cg=caregivers.find(c=>c.id===e.caregiverId);const cl=clients.find(c=>c.id===e.clientId);
        return <tr key={e.id} style={{background:e.status==="flagged"?"var(--err-l)":e.status==="review"?"var(--warn-l)":""}}>
          <td style={{fontWeight:600}}>{fmtD(e.date)}</td>
          <td>{cg?.name}</td><td style={{fontWeight:600}}>{cl?.name}</td>
          <td style={{fontSize:11}}>{e.scheduled.start}-{e.scheduled.end} ({e.scheduled.hours}h)</td>
          <td style={{fontSize:11}}>{e.actual.clockIn}-{e.actual.clockOut} ({e.actual.hours}h)</td>
          <td style={{textAlign:"right",fontWeight:700,color:e.variance<0?"var(--err)":"var(--ok)"}}>{e.variance>0?"+":""}{e.variance.toFixed(1)}h</td>
          <td>{e.gpsMatch?<span className="tag tag-ok">Match</span>:<span className="tag tag-er">Mismatch</span>}</td>
          <td><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{e.flags.map((f,i)=> <span key={i} className="tag tag-wn" style={{fontSize:8}}>{f.replace(/_/g," ")}</span>)}{e.flags.length===0&&<span style={{color:"var(--t3)",fontSize:11}}>Clean</span>}</div></td>
          <td style={{textAlign:"right"}}>{$(e.billedAmount)}</td>
          <td style={{textAlign:"right"}}>{$(e.paidAmount)}</td>
          <td style={{textAlign:"right",fontWeight:700,color:"var(--ok)"}}>{$(e.margin)}</td>
          <td><span className={`tag ${e.status==="approved"?"tag-ok":e.status==="review"?"tag-wn":"tag-er"}`}>{e.status}</span></td>
          <td><button className="btn btn-sm btn-s" onClick={()=>setSel(e)}>Drill</button></td>
        </tr>;})}
    </tbody></table></div></div>

    {/* Drill-Down Modal */}
    {sel&& <div className="modal-bg" onClick={()=>setSel(null)}><div className="modal" style={{maxWidth:640}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">🔍 Entry Detail<button className="btn btn-sm btn-s" onClick={()=>setSel(null)}>✕</button></div>
      <div className="modal-b">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div style={{padding:12,background:"var(--bg)",borderRadius:"var(--rs)"}}><div style={{fontSize:10,color:"var(--t2)",textTransform:"uppercase",fontWeight:600}}>Caregiver</div><div style={{fontWeight:700,fontSize:14}}>{caregivers.find(c=>c.id===sel.caregiverId)?.name}</div></div>
          <div style={{padding:12,background:"var(--bg)",borderRadius:"var(--rs)"}}><div style={{fontSize:10,color:"var(--t2)",textTransform:"uppercase",fontWeight:600}}>Client</div><div style={{fontWeight:700,fontSize:14}}>{clients.find(c=>c.id===sel.clientId)?.name}</div></div>
        </div>

        <h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>⏱ Time Analysis</h4>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          <div style={{padding:12,background:"var(--blue-l)",borderRadius:"var(--rs)",textAlign:"center"}}><div style={{fontSize:10,color:"var(--blue)"}}>Scheduled</div><div style={{fontFamily:"var(--fd)",fontSize:20,fontWeight:400}}>{sel.scheduled.hours}h</div><div style={{fontSize:11,color:"var(--t2)"}}>{sel.scheduled.start} - {sel.scheduled.end}</div></div>
          <div style={{padding:12,background:sel.variance<0?"var(--err-l)":"var(--ok-l)",borderRadius:"var(--rs)",textAlign:"center"}}><div style={{fontSize:10,color:sel.variance<0?"var(--err)":"var(--ok)"}}>Actual</div><div style={{fontFamily:"var(--fd)",fontSize:20,fontWeight:400}}>{sel.actual.hours}h</div><div style={{fontSize:11,color:"var(--t2)"}}>{sel.actual.clockIn} - {sel.actual.clockOut}</div></div>
          <div style={{padding:12,background:"var(--bg)",borderRadius:"var(--rs)",textAlign:"center"}}><div style={{fontSize:10,color:"var(--t2)"}}>Variance</div><div style={{fontFamily:"var(--fd)",fontSize:20,fontWeight:400,color:sel.variance<0?"var(--err)":"var(--ok)"}}>{sel.variance>0?"+":""}{sel.variance.toFixed(1)}h</div></div>
        </div>

        <h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>📍 GPS Verification</h4>
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--bdr)"}}><span style={{color:"var(--t2)",fontSize:12}}>Clock-In Location</span><span style={{fontSize:12,fontWeight:600}}>📍 {sel.gpsIn}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--bdr)"}}><span style={{color:"var(--t2)",fontSize:12}}>Clock-Out Location</span><span style={{fontSize:12,fontWeight:600}}>📍 {sel.gpsOut}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0"}}><span style={{color:"var(--t2)",fontSize:12}}>Geofence Match</span>{sel.gpsMatch?<span className="tag tag-ok">Verified</span>:<span className="tag tag-er">Mismatch — Investigate</span>}</div>
        </div>

        <h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>💰 Financial Impact</h4>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          <div style={{padding:12,background:"var(--bg)",borderRadius:"var(--rs)",textAlign:"center"}}><div style={{fontSize:10,color:"var(--t2)"}}>Billed</div><div style={{fontFamily:"var(--fd)",fontSize:18,fontWeight:900}}>{$(sel.billedAmount)}</div><div style={{fontSize:11,color:"var(--t2)"}}>{$(sel.billRate)}/hr</div></div>
          <div style={{padding:12,background:"var(--bg)",borderRadius:"var(--rs)",textAlign:"center"}}><div style={{fontSize:10,color:"var(--t2)"}}>Paid</div><div style={{fontFamily:"var(--fd)",fontSize:18,fontWeight:900}}>{$(sel.paidAmount)}</div><div style={{fontSize:11,color:"var(--t2)"}}>{$(sel.payRate)}/hr</div></div>
          <div style={{padding:12,background:"var(--ok-l)",borderRadius:"var(--rs)",textAlign:"center"}}><div style={{fontSize:10,color:"var(--ok)"}}>Margin</div><div style={{fontFamily:"var(--fd)",fontSize:18,fontWeight:900,color:"var(--ok)"}}>{$(sel.margin)}</div><div style={{fontSize:11,color:"var(--t2)"}}>{sel.billedAmount>0?((sel.margin/sel.billedAmount)*100).toFixed(0):0}%</div></div>
        </div>

        {sel.flags.length>0&& <><h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>⚠️ Flags & Actions</h4>
          {sel.flags.map((f,i)=> <div key={i} style={{padding:"10px 14px",background:"var(--warn-l)",borderRadius:"var(--rs)",marginBottom:6,fontSize:12,borderLeft:"3px solid var(--warn)"}}>
            <strong>{f.replace(/_/g," ")}:</strong> {f==="LATE_ARRIVAL"&&`Caregiver clocked in at ${sel.actual.clockIn} vs scheduled ${sel.scheduled.start}. Discuss with caregiver and document.`}
            {f==="SHORT_SHIFT"&&`Shift was ${Math.abs(sel.variance).toFixed(1)} hours shorter than scheduled. Verify with client if early departure was agreed.`}
            {f==="GPS_MISMATCH_OUT"&&`Clock-out location does not match client address. May indicate caregiver left area before clocking out.`}
            {f==="ADMIN_EDITED"&&`This entry was manually edited by an administrator. Original data may differ.`}
            {f==="EMERGENCY"&&`Emergency shift — non-standard hours. Verify billing applies.`}
          </div>)}</>}

        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button className="btn btn-ok" style={{flex:1}}>✓ Approve</button>
          <button className="btn btn-er" style={{flex:1}}>✕ Reject</button>
          <button className="btn btn-s" style={{flex:1}}>📝 Add Note</button>
        </div>
      </div>
    </div></div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// RECRUITING — Caregiver & Client
// ═══════════════════════════════════════════════════════════════════════
function RecruitingPage({applicants,setApplicants,leads,setLeads,clients,setClients,caregivers,setCaregivers,setSel,setPg}){
  const [tab,setTab]=useState("caregivers");
  const [showAddAp,setShowAddAp]=useState(false);
  const [showAddLd,setShowAddLd]=useState(false);
  const [selAp,setSelAp]=useState(null);
  const [selLd,setSelLd]=useState(null);
  const [noteInput,setNoteInput]=useState("");
  const [showOnboard,setShowOnboard]=useState(null);
  const stages={new:"New",screening:"Screening",phone_screen:"Phone Screen",interview:"Interview",reference_check:"Reference Check",offer:"Offer Extended",hired:"Hired",rejected:"Rejected",withdrawn:"Withdrawn"};
  const clStages={new:"New Lead",inquiry:"Inquiry",assessment:"Assessment",proposal:"Proposal Sent",active:"Active Client",declined:"Declined"};
  const stageColors={new:"tag-pu",screening:"tag-bl",phone_screen:"tag-bl",interview:"tag-wn",reference_check:"tag-wn",offer:"tag-ok",hired:"tag-ok",rejected:"tag-er",withdrawn:"tag-er"};
  const clColors={new:"tag-pu",inquiry:"tag-bl",assessment:"tag-wn",proposal:"tag-ok",active:"tag-ok",declined:"tag-er"};

  // Empty forms
  const emptyAp={name:"",email:"",phone:"",certs:[],experience:"",availability:"Full-time",preferredAreas:[],status:"new",appliedDate:today(),notes:"",bgCheck:"not_started",source:"",score:null,activityLog:[]};
  const emptyLd={name:"",age:"",phone:"",email:"",referralSource:"",needs:"",hoursNeeded:"",status:"new",assessmentDate:"",notes:"",urgency:"medium",activityLog:[]};
  const [apForm,setApForm]=useState(emptyAp);
  const [ldForm,setLdForm]=useState(emptyLd);
  const [certInput,setCertInput]=useState("");
  const [areaInput,setAreaInput]=useState("");

  // AI Score (simple rule-based)
  const calcScore=(ap)=>{
    let s=50;
    if(ap.certs?.length>=3)s+=15;else if(ap.certs?.length>=2)s+=10;else if(ap.certs?.length>=1)s+=5;
    if(ap.experience?.includes("7")||ap.experience?.includes("8")||ap.experience?.includes("10"))s+=15;
    else if(ap.experience?.includes("3")||ap.experience?.includes("4")||ap.experience?.includes("5"))s+=10;
    else if(ap.experience?.includes("1")||ap.experience?.includes("2"))s+=5;
    if(ap.bgCheck==="passed")s+=10;
    if(ap.certs?.some(c=>c.toLowerCase().includes("dementia")||c.toLowerCase().includes("wound")||c.toLowerCase().includes("parkinson")))s+=10;
    return Math.min(100,s);
  };

  // Add activity to log
  const addActivity=(list,setList,id,text)=>{
    setList(p=>p.map(a=>a.id===id?{...a,activityLog:[...(a.activityLog||[]),{date:now().toISOString(),text}]}:a));
  };

  // Move stage with activity logging
  const moveApStage=(id,newStatus,note)=>{
    setApplicants(p=>p.map(a=>a.id===id?{...a,status:newStatus,activityLog:[...(a.activityLog||[]),{date:now().toISOString(),text:note||`Moved to ${stages[newStatus]}`}]}:a));
  };
  const moveLdStage=(id,newStatus,note)=>{
    setLeads(p=>p.map(l=>l.id===id?{...l,status:newStatus,activityLog:[...(l.activityLog||[]),{date:now().toISOString(),text:note||`Moved to ${clStages[newStatus]}`}]}:l));
  };

  // Convert hired applicant to caregiver
  const convertToCaregiver=(ap)=>{
    const newId="CG"+uid();
    const newCG={id:newId,shortId:newId,name:ap.name,email:ap.email,phone:ap.phone,rate:20,certs:ap.certs||[],hireDate:today(),photo:null,avatar:ap.name.split(" ").map(n=>n[0]).join(""),status:"active",trainingComplete:0,trainingTotal:12};
    setCaregivers(p=>[...p,newCG]);
    addActivity(applicants,setApplicants,ap.id,"✅ Converted to caregiver record: "+newId);
    return newId;
  };

  // Convert active lead to client
  const convertToClient=(ld)=>{
    const newId="CL"+uid();
    const newClient={id:newId,shortId:newId,name:ld.name,age:parseInt(ld.age)||0,addr:"",phone:ld.phone,emergency:"",dx:[],meds:[],adl:{},social:{interests:[]},preferences:{},familyPortal:{enabled:true,contacts:[]},status:"active",riskLevel:"low",billRate:35,photo:null};
    setClients(p=>[...p,newClient]);
    addActivity(leads,setLeads,ld.id,"✅ Converted to client record: "+newId);
    if(setSel)setSel(newId);
    return newId;
  };

  // Onboarding checklist items
  const onboardItems=["Background check completed","W-4 / W-9 signed","I-9 Employment Verification","Direct deposit form","HIPAA training completed","CPR/BLS certification verified","TB test results on file","Orientation completed","First client assignment","Emergency contact form","Vehicle insurance (if driving)","Uniform / ID badge issued"];

  return <div>
    <div className="hdr"><div><h2>Recruiting</h2><div className="hdr-sub">Caregiver pipeline & client acquisition</div></div>
      <div style={{display:"flex",gap:6}}>
        {tab==="caregivers"&&<button className="btn btn-p btn-sm" onClick={()=>{setApForm(emptyAp);setCertInput("");setAreaInput("");setShowAddAp(true);}}>+ Add Applicant</button>}
        {tab==="clients"&&<button className="btn btn-p btn-sm" onClick={()=>{setLdForm(emptyLd);setShowAddLd(true);}}>+ Add Lead</button>}
      </div>
    </div>
    <div className="tab-row">
      <button className={`tab-btn ${tab==="caregivers"?"act":""}`} onClick={()=>setTab("caregivers")}>👩‍⚕️ Caregiver Pipeline ({applicants.length})</button>
      <button className={`tab-btn ${tab==="clients"?"act":""}`} onClick={()=>setTab("clients")}>🏠 Client Leads ({leads.length})</button>
    </div>

    {/* ═══ CAREGIVER PIPELINE ═══ */}
    {tab==="caregivers"&& <div>
      <div className="sg">
        {["new","screening","interview","offer","hired"].map(s=> <div key={s} className={`sc ${s==="hired"?"ok":s==="offer"?"ok":s==="new"?"pu":"bl"}`}><span className="sl">{stages[s]}</span><span className="sv">{applicants.filter(a=>a.status===s).length}</span></div>)}
      </div>

      {applicants.filter(a=>a.status!=="rejected"&&a.status!=="withdrawn").map(ap=> <div key={ap.id} className="card card-b" style={{borderLeft:`4px solid ${ap.status==="hired"?"var(--ok)":ap.status==="offer"?"#3c4f3d":ap.status==="interview"?"var(--blue)":ap.status==="new"?"var(--purple)":"var(--warn)"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:400}}>{ap.name}</span>
              {ap.score!=null&&<span style={{background:ap.score>=75?"var(--ok)":ap.score>=50?"var(--warn)":"var(--err)",color:"#fff",padding:"1px 8px",fontSize:10,fontWeight:700}}>{ap.score}/100</span>}
            </div>
            <div style={{fontSize:12,color:"var(--t2)"}}>{ap.email} • {ap.phone}</div>
          </div>
          <div style={{display:"flex",gap:4}}>
            <span className={`tag ${stageColors[ap.status]||"tag-bl"}`}>{stages[ap.status]}</span>
            {ap.bgCheck==="passed"&&<span className="tag tag-ok">BG ✓</span>}
            {ap.bgCheck==="pending"&&<span className="tag tag-wn">BG Pending</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>{(ap.certs||[]).map(c=> <span key={c} className="tag tag-bl">{c}</span>)}</div>
        <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.6,marginBottom:8}}>
          <div><strong>Experience:</strong> {ap.experience}</div>
          <div><strong>Availability:</strong> {ap.availability} • Areas: {(ap.preferredAreas||[]).join(", ")}</div>
          <div><strong>Source:</strong> {ap.source} • Applied: {fmtD(ap.appliedDate)}</div>
          {ap.notes&& <div style={{marginTop:4,padding:"6px 10px",background:"var(--bg)"}}>{ap.notes}</div>}
        </div>

        {/* Activity Log */}
        {(ap.activityLog||[]).length>0&&<div style={{marginBottom:8,padding:"6px 10px",background:"#f9f9f4",fontSize:11}}>
          <div style={{fontWeight:700,fontSize:10,textTransform:"uppercase",marginBottom:4}}>Activity Log</div>
          {(ap.activityLog||[]).slice(-3).map((a,i)=><div key={i} style={{color:"var(--t2)"}}>{new Date(a.date).toLocaleDateString()} — {a.text}</div>)}
        </div>}

        {/* Stage Actions */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {ap.status==="new"&&<><button className="btn btn-sm btn-bl" onClick={()=>moveApStage(ap.id,"screening","Started screening")}>Start Screening</button><button className="btn btn-sm btn-s" onClick={()=>{const s=calcScore(ap);setApplicants(p=>p.map(a=>a.id===ap.id?{...a,score:s,activityLog:[...(a.activityLog||[]),{date:now().toISOString(),text:`AI Score: ${s}/100`}]}:a));}}>🤖 AI Score</button></>}
          {ap.status==="screening"&&<><button className="btn btn-sm btn-bl" onClick={()=>moveApStage(ap.id,"phone_screen","Phone screen scheduled")}>Phone Screen</button></>}
          {ap.status==="phone_screen"&&<button className="btn btn-sm btn-bl" onClick={()=>moveApStage(ap.id,"interview","Interview scheduled")}>Schedule Interview</button>}
          {ap.status==="interview"&&<><button className="btn btn-sm btn-bl" onClick={()=>moveApStage(ap.id,"reference_check","Checking references")}>Check References</button><button className="btn btn-sm btn-ok" onClick={()=>moveApStage(ap.id,"offer","Offer extended")}>Extend Offer</button></>}
          {ap.status==="reference_check"&&<button className="btn btn-sm btn-ok" onClick={()=>moveApStage(ap.id,"offer","Offer extended, references cleared")}>Extend Offer</button>}
          {ap.status==="offer"&&<button className="btn btn-sm btn-ok" onClick={()=>{moveApStage(ap.id,"hired","Accepted offer — HIRED!");setShowOnboard(ap.id);}}>✅ Mark Hired</button>}
          {ap.status==="hired"&&<><button className="btn btn-sm btn-ok" onClick={()=>{convertToCaregiver(ap);}}>🔄 Convert to Caregiver</button><button className="btn btn-sm btn-s" onClick={()=>setShowOnboard(ap.id)}>📋 Onboarding</button></>}
          <button className="btn btn-sm btn-s" onClick={()=>setSelAp(ap)}>📝 Notes</button>
          <button className="btn btn-sm btn-s" onClick={()=>{setApForm({...ap});setShowAddAp(true);}}>✏️ Edit</button>
          {ap.status!=="hired"&&<button className="btn btn-sm btn-s" style={{color:"var(--err)"}} onClick={()=>moveApStage(ap.id,"rejected","Rejected")}>✕ Reject</button>}
          {ap.status!=="hired"&&<button className="btn btn-sm btn-s" style={{color:"var(--ochre)"}} onClick={()=>moveApStage(ap.id,"withdrawn","Withdrawn")}>Archive</button>}
        </div>
      </div>)}

      {/* Rejected/Withdrawn */}
      {applicants.filter(a=>a.status==="rejected"||a.status==="withdrawn").length>0&&<details style={{marginTop:14}}><summary style={{cursor:"pointer",fontSize:12,color:"var(--t2)",fontWeight:600}}>Rejected / Withdrawn ({applicants.filter(a=>a.status==="rejected"||a.status==="withdrawn").length})</summary>
        {applicants.filter(a=>a.status==="rejected"||a.status==="withdrawn").map(ap=><div key={ap.id} style={{padding:"10px 16px",borderBottom:"var(--border-thin)",opacity:.6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><span style={{fontWeight:600}}>{ap.name}</span><span style={{fontSize:11,color:"var(--t2)",marginLeft:8}}>{ap.source} • {fmtD(ap.appliedDate)}</span></div>
          <div style={{display:"flex",gap:4}}><span className={`tag ${stageColors[ap.status]}`}>{stages[ap.status]}</span><button className="btn btn-sm btn-s" onClick={()=>moveApStage(ap.id,"new","Restored to pipeline")}>Restore</button></div>
        </div>)}
      </details>}
    </div>}

    {/* ═══ CLIENT LEADS ═══ */}
    {tab==="clients"&& <div>
      <div className="sg">
        {["new","inquiry","assessment","proposal","active"].map(s=> <div key={s} className={`sc ${s==="active"?"ok":s==="proposal"?"ok":s==="new"?"pu":"bl"}`}><span className="sl">{clStages[s]||s}</span><span className="sv">{leads.filter(l=>l.status===s).length}</span></div>)}
      </div>

      {leads.filter(l=>l.status!=="declined").map(ld=> <div key={ld.id} className="card card-b" style={{borderLeft:`4px solid ${ld.status==="active"?"var(--ok)":ld.urgency==="high"?"var(--err)":"var(--warn)"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div><div style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:400}}>{ld.name}</div><div style={{fontSize:12,color:"var(--t2)"}}>Age {ld.age} • {ld.phone}{ld.email?" • "+ld.email:""}</div></div>
          <div style={{display:"flex",gap:4}}><span className={`tag ${clColors[ld.status]||"tag-bl"}`}>{clStages[ld.status]||ld.status}</span>
            <span className={`tag ${ld.urgency==="high"?"tag-er":"tag-wn"}`}>{ld.urgency} urgency</span></div>
        </div>
        <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.7,marginBottom:8}}>
          <div><strong>Referral:</strong> {ld.referralSource}</div>
          <div><strong>Needs:</strong> {ld.needs}</div>
          <div><strong>Hours:</strong> {ld.hoursNeeded}</div>
          {ld.assessmentDate&& <div><strong>Assessment:</strong> {fmtD(ld.assessmentDate)}</div>}
          {ld.notes&& <div style={{marginTop:4,padding:"6px 10px",background:"var(--bg)"}}>{ld.notes}</div>}
        </div>

        {(ld.activityLog||[]).length>0&&<div style={{marginBottom:8,padding:"6px 10px",background:"#f9f9f4",fontSize:11}}>
          <div style={{fontWeight:700,fontSize:10,textTransform:"uppercase",marginBottom:4}}>Activity Log</div>
          {(ld.activityLog||[]).slice(-3).map((a,i)=><div key={i} style={{color:"var(--t2)"}}>{new Date(a.date).toLocaleDateString()} — {a.text}</div>)}
        </div>}

        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {ld.status==="new"&&<button className="btn btn-sm btn-bl" onClick={()=>moveLdStage(ld.id,"inquiry","Initial contact made")}>Contact</button>}
          {ld.status==="inquiry"&&<button className="btn btn-sm btn-bl" onClick={()=>moveLdStage(ld.id,"assessment","Assessment scheduled")}>Schedule Assessment</button>}
          {ld.status==="assessment"&&<button className="btn btn-sm btn-ok" onClick={()=>moveLdStage(ld.id,"proposal","Proposal sent to family")}>Send Proposal</button>}
          {ld.status==="proposal"&&<button className="btn btn-sm btn-ok" onClick={()=>{moveLdStage(ld.id,"active","Converted to active client!");convertToClient(ld);}}>✅ Convert to Client</button>}
          {ld.status==="active"&&<button className="btn btn-sm btn-ok" onClick={()=>{if(setPg)setPg("clients");}}>View Client Profile</button>}
          <button className="btn btn-sm btn-s" onClick={()=>setSelLd(ld)}>📝 Notes</button>
          <button className="btn btn-sm btn-s" onClick={()=>{setLdForm({...ld});setShowAddLd(true);}}>✏️ Edit</button>
          {ld.status!=="active"&&<button className="btn btn-sm btn-s" style={{color:"var(--err)"}} onClick={()=>moveLdStage(ld.id,"declined","Lead declined")}>✕ Decline</button>}
        </div>
      </div>)}

      {leads.filter(l=>l.status==="declined").length>0&&<details style={{marginTop:14}}><summary style={{cursor:"pointer",fontSize:12,color:"var(--t2)",fontWeight:600}}>Declined ({leads.filter(l=>l.status==="declined").length})</summary>
        {leads.filter(l=>l.status==="declined").map(ld=><div key={ld.id} style={{padding:"10px 16px",borderBottom:"var(--border-thin)",opacity:.6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><span style={{fontWeight:600}}>{ld.name}</span><span style={{fontSize:11,color:"var(--t2)",marginLeft:8}}>{ld.referralSource}</span></div>
          <div style={{display:"flex",gap:4}}><span className="tag tag-er">Declined</span><button className="btn btn-sm btn-s" onClick={()=>moveLdStage(ld.id,"new","Restored to pipeline")}>Restore</button></div>
        </div>)}
      </details>}
    </div>}

    {/* ═══ ADD/EDIT APPLICANT MODAL ═══ */}
    {showAddAp&& <div className="modal-bg" onClick={()=>setShowAddAp(false)}><div className="modal" style={{maxWidth:600,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">{apForm.id?"Edit Applicant":"Add New Applicant"}<button className="btn btn-sm btn-s" onClick={()=>setShowAddAp(false)}>✕</button></div>
      <div className="modal-b">
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Full Name *</label><input value={apForm.name} onChange={e=>setApForm(p=>({...p,name:e.target.value}))}/></div>
          <div className="fi"><label>Email</label><input value={apForm.email} onChange={e=>setApForm(p=>({...p,email:e.target.value}))}/></div>
        </div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Phone</label><input value={apForm.phone} onChange={e=>setApForm(p=>({...p,phone:e.target.value}))}/></div>
          <div className="fi"><label>Source</label><select value={apForm.source} onChange={e=>setApForm(p=>({...p,source:e.target.value}))}><option value="">Select source</option><option>Indeed</option><option>LinkedIn</option><option>CWINathome.com</option><option>Referral</option><option>Job Fair</option><option>Other</option></select></div>
        </div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Experience</label><input value={apForm.experience} onChange={e=>setApForm(p=>({...p,experience:e.target.value}))} placeholder="e.g. 3 years home care"/></div>
          <div className="fi"><label>Availability</label><select value={apForm.availability} onChange={e=>setApForm(p=>({...p,availability:e.target.value}))}><option>Full-time</option><option>Part-time</option><option>Weekends</option><option>Overnight</option><option>Flexible</option></select></div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Certifications</label>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>{(apForm.certs||[]).map((c,i)=><span key={i} className="tag tag-bl" style={{cursor:"pointer"}} onClick={()=>setApForm(p=>({...p,certs:p.certs.filter((_,j)=>j!==i)}))}>{c} ✕</span>)}</div>
          <div style={{display:"flex",gap:4}}><select value={certInput} onChange={e=>setCertInput(e.target.value)}><option value="">Add cert...</option><option>CNA</option><option>HHA</option><option>CPR/BLS</option><option>First Aid</option><option>Dementia Care</option><option>Alzheimer's Care</option><option>Parkinson's Care</option><option>Wound Care</option><option>Medication Aide</option></select><button className="btn btn-sm btn-s" onClick={()=>{if(certInput){setApForm(p=>({...p,certs:[...(p.certs||[]),certInput]}));setCertInput("");}}}>Add</button></div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Preferred Areas</label>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>{(apForm.preferredAreas||[]).map((a,i)=><span key={i} className="tag tag-wn" style={{cursor:"pointer"}} onClick={()=>setApForm(p=>({...p,preferredAreas:p.preferredAreas.filter((_,j)=>j!==i)}))}>{a} ✕</span>)}</div>
          <div style={{display:"flex",gap:4}}><input value={areaInput} onChange={e=>setAreaInput(e.target.value)} placeholder="e.g. Lincoln Park" onKeyDown={e=>{if(e.key==="Enter"&&areaInput.trim()){setApForm(p=>({...p,preferredAreas:[...(p.preferredAreas||[]),areaInput.trim()]}));setAreaInput("");}}}/><button className="btn btn-sm btn-s" onClick={()=>{if(areaInput.trim()){setApForm(p=>({...p,preferredAreas:[...(p.preferredAreas||[]),areaInput.trim()]}));setAreaInput("");}}}>Add</button></div>
        </div>
        <div className="fi" style={{marginBottom:12}}><label>Notes</label><textarea value={apForm.notes||""} onChange={e=>setApForm(p=>({...p,notes:e.target.value}))} rows={3} style={{width:"100%"}}/></div>
        <button className="btn btn-p" style={{width:"100%"}} disabled={!apForm.name?.trim()} onClick={()=>{
          if(apForm.id){setApplicants(p=>p.map(a=>a.id===apForm.id?{...apForm}:a));}
          else{const newAp={...apForm,id:"AP"+uid(),score:calcScore(apForm),activityLog:[{date:now().toISOString(),text:"Application received via "+apForm.source}]};setApplicants(p=>[newAp,...p]);}
          setShowAddAp(false);
        }}>{apForm.id?"Save Changes":"Add Applicant"}</button>
      </div>
    </div></div>}

    {/* ═══ ADD/EDIT LEAD MODAL ═══ */}
    {showAddLd&& <div className="modal-bg" onClick={()=>setShowAddLd(false)}><div className="modal" style={{maxWidth:600,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">{ldForm.id?"Edit Lead":"Add New Lead"}<button className="btn btn-sm btn-s" onClick={()=>setShowAddLd(false)}>✕</button></div>
      <div className="modal-b">
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Client Name *</label><input value={ldForm.name} onChange={e=>setLdForm(p=>({...p,name:e.target.value}))}/></div>
          <div className="fi"><label>Age</label><input type="number" value={ldForm.age||""} onChange={e=>setLdForm(p=>({...p,age:e.target.value}))}/></div>
        </div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Phone</label><input value={ldForm.phone} onChange={e=>setLdForm(p=>({...p,phone:e.target.value}))}/></div>
          <div className="fi"><label>Email</label><input value={ldForm.email||""} onChange={e=>setLdForm(p=>({...p,email:e.target.value}))}/></div>
        </div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Referral Source</label><select value={ldForm.referralSource} onChange={e=>setLdForm(p=>({...p,referralSource:e.target.value}))}><option value="">Select source</option><option>Hospital Discharge</option><option>Doctor Referral</option><option>Family Self-Referral</option><option>Website</option><option>Veterans Affairs</option><option>Insurance Referral</option><option>Other</option></select></div>
          <div className="fi"><label>Urgency</label><select value={ldForm.urgency} onChange={e=>setLdForm(p=>({...p,urgency:e.target.value}))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
        </div>
        <div className="fi" style={{marginBottom:12}}><label>Care Needs</label><textarea value={ldForm.needs||""} onChange={e=>setLdForm(p=>({...p,needs:e.target.value}))} rows={2} style={{width:"100%"}} placeholder="e.g. Post-surgery recovery, ADL assistance, companionship"/></div>
        <div className="fg" style={{marginBottom:12}}>
          <div className="fi"><label>Hours Needed</label><input value={ldForm.hoursNeeded||""} onChange={e=>setLdForm(p=>({...p,hoursNeeded:e.target.value}))} placeholder="e.g. 6 hrs/day, 5 days/week"/></div>
          <div className="fi"><label>Assessment Date</label><input type="date" value={ldForm.assessmentDate||""} onChange={e=>setLdForm(p=>({...p,assessmentDate:e.target.value}))}/></div>
        </div>
        <div className="fi" style={{marginBottom:12}}><label>Notes</label><textarea value={ldForm.notes||""} onChange={e=>setLdForm(p=>({...p,notes:e.target.value}))} rows={3} style={{width:"100%"}}/></div>
        <button className="btn btn-p" style={{width:"100%"}} disabled={!ldForm.name?.trim()} onClick={()=>{
          if(ldForm.id){setLeads(p=>p.map(l=>l.id===ldForm.id?{...ldForm}:l));}
          else{const newLd={...ldForm,id:"LD"+uid(),activityLog:[{date:now().toISOString(),text:"Lead received via "+ldForm.referralSource}]};setLeads(p=>[newLd,...p]);}
          setShowAddLd(false);
        }}>{ldForm.id?"Save Changes":"Add Lead"}</button>
      </div>
    </div></div>}

    {/* ═══ NOTES MODAL ═══ */}
    {(selAp||selLd)&& <div className="modal-bg" onClick={()=>{setSelAp(null);setSelLd(null);setNoteInput("");}}><div className="modal" style={{maxWidth:500}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">Notes — {selAp?.name||selLd?.name}<button className="btn btn-sm btn-s" onClick={()=>{setSelAp(null);setSelLd(null);setNoteInput("");}}>✕</button></div>
      <div className="modal-b">
        <div style={{maxHeight:300,overflow:"auto",marginBottom:12}}>
          {((selAp||selLd)?.activityLog||[]).map((a,i)=><div key={i} style={{padding:"8px 0",borderBottom:"var(--border-thin)",fontSize:12}}>
            <div style={{fontWeight:600,fontSize:10,color:"var(--t2)"}}>{new Date(a.date).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} {new Date(a.date).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
            <div style={{marginTop:2}}>{a.text}</div>
          </div>)}
          {((selAp||selLd)?.activityLog||[]).length===0&&<div className="empty">No activity yet</div>}
        </div>
        <div style={{display:"flex",gap:6}}>
          <input value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder="Add a note..." style={{flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&noteInput.trim()){
            if(selAp)addActivity(applicants,setApplicants,selAp.id,noteInput.trim());
            if(selLd)addActivity(leads,setLeads,selLd.id,noteInput.trim());
            setNoteInput("");
          }}}/>
          <button className="btn btn-sm btn-p" onClick={()=>{if(!noteInput.trim())return;
            if(selAp)addActivity(applicants,setApplicants,selAp.id,noteInput.trim());
            if(selLd)addActivity(leads,setLeads,selLd.id,noteInput.trim());
            setNoteInput("");}}>Add Note</button>
        </div>
      </div>
    </div></div>}

    {/* ═══ ONBOARDING CHECKLIST MODAL ═══ */}
    {showOnboard&& <div className="modal-bg" onClick={()=>setShowOnboard(null)}><div className="modal" style={{maxWidth:500}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">📋 Onboarding Checklist<button className="btn btn-sm btn-s" onClick={()=>setShowOnboard(null)}>✕</button></div>
      <div className="modal-b">
        <div style={{marginBottom:12,fontSize:13}}><strong>{applicants.find(a=>a.id===showOnboard)?.name}</strong> — New Hire Onboarding</div>
        {onboardItems.map((item,i)=>{
          const ap=applicants.find(a=>a.id===showOnboard);
          const completed=(ap?.onboarding||[]).includes(i);
          return <div key={i} style={{padding:"10px 14px",borderBottom:"var(--border-thin)",display:"flex",gap:10,alignItems:"center",cursor:"pointer",background:completed?"#f0fff0":"transparent"}} onClick={()=>{
            setApplicants(p=>p.map(a=>a.id===showOnboard?{...a,onboarding:completed?(a.onboarding||[]).filter(j=>j!==i):[...(a.onboarding||[]),i]}:a));
          }}>
            <div style={{width:20,height:20,border:"2px solid "+(completed?"var(--ok)":"#ccc"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"var(--ok)",fontWeight:700}}>{completed?"✓":""}</div>
            <div style={{fontSize:13,textDecoration:completed?"line-through":"none",color:completed?"var(--t2)":"var(--text)"}}>{item}</div>
          </div>;
        })}
        <div style={{marginTop:12,fontSize:12,color:"var(--t2)",textAlign:"center"}}>
          {(applicants.find(a=>a.id===showOnboard)?.onboarding||[]).length}/{onboardItems.length} complete
        </div>
      </div>
    </div></div>}
  </div>;
}

function CompliancePage({items,setItems,caregivers,clients}){
  const overdue=items.filter(i=>i.status==="overdue");
  const expiring=items.filter(i=>i.status==="expiring_soon");
  const current=items.filter(i=>i.status==="current");

  return <div>
    <div className="hdr"><div><h2>Compliance Center</h2><div className="hdr-sub">Certifications, agreements, and regulatory tracking</div></div></div>

    <div className="sg">
      <div className="sc er"><span className="sl">Overdue</span><span className="sv">{overdue.length}</span><span className="ss">Immediate action needed</span></div>
      <div className="sc wn"><span className="sl">Expiring Soon</span><span className="sv">{expiring.length}</span><span className="ss">Within 30 days</span></div>
      <div className="sc ok"><span className="sl">Current</span><span className="sv">{current.length}</span><span className="ss">Fully compliant</span></div>
      <div className="sc bl"><span className="sl">Total Items</span><span className="sv">{items.length}</span><span className="ss">Being tracked</span></div>
    </div>

    {overdue.length>0&& <div className="ai-card" style={{background:"linear-gradient(135deg,#3d0000,#1a0000)"}}>
      <h4><span className="pulse" style={{background:"var(--err)"}}/>Compliance Alerts</h4>
      <p>{overdue.map(i=>`⚠️ ${i.type} for ${i.entity} is OVERDUE (due ${fmtD(i.dueDate)}). `).join("")}Take immediate action to maintain regulatory compliance.</p>
    </div>}

    {/* Overdue */}
    {overdue.length>0&& <div className="card"><div className="card-h" style={{background:"var(--err-l)"}}><h3 style={{color:"var(--err)"}}>⚠️ Overdue ({overdue.length})</h3></div>
      {overdue.map(item=> <div key={item.id} style={{padding:"12px 18px",borderBottom:"1px solid var(--bdr)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontWeight:700,fontSize:14}}>{item.type}</div><div style={{fontSize:12,color:"var(--t2)"}}>{item.entity} ({item.entityType}) • Due: {fmtD(item.dueDate)}</div>{item.notes&& <div style={{fontSize:11,color:"var(--t2)",marginTop:2}}>{item.notes}</div>}</div>
        <div style={{display:"flex",gap:6}}><span className="tag tag-er">OVERDUE</span><button className="btn btn-sm btn-ok" onClick={()=>setItems(p=>p.map(i=>i.id===item.id?{...i,status:"current",dueDate:"2027-"+item.dueDate.slice(5)}:i))}>Mark Resolved</button></div>
      </div>)}
    </div>}

    {/* Expiring */}
    {expiring.length>0&& <div className="card"><div className="card-h" style={{background:"var(--warn-l)"}}><h3>⏰ Expiring Soon ({expiring.length})</h3></div>
      {expiring.map(item=> <div key={item.id} style={{padding:"12px 18px",borderBottom:"1px solid var(--bdr)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontWeight:700,fontSize:14}}>{item.type}</div><div style={{fontSize:12,color:"var(--t2)"}}>{item.entity} ({item.entityType}) • Due: {fmtD(item.dueDate)}</div>{item.notes&& <div style={{fontSize:11,color:"var(--t2)",marginTop:2}}>{item.notes}</div>}</div>
        <div style={{display:"flex",gap:6}}><span className="tag tag-wn">EXPIRING</span><button className="btn btn-sm btn-ok" onClick={()=>setItems(p=>p.map(i=>i.id===item.id?{...i,status:"current",dueDate:"2027-"+item.dueDate.slice(5)}:i))}>Renew</button></div>
      </div>)}
    </div>}

    {/* Current */}
    <div className="card"><div className="card-h"><h3>✅ Current ({current.length})</h3></div>
      <div className="tw"><table><thead><tr><th>Type</th><th>Entity</th><th>Category</th><th>Due Date</th><th>Notes</th><th>Status</th></tr></thead><tbody>
        {current.map(item=> <tr key={item.id}>
          <td style={{fontWeight:600}}>{item.type}</td><td>{item.entity}</td>
          <td><span className={`tag ${item.entityType==="caregiver"?"tag-bl":item.entityType==="client"?"tag-pu":"tag-wn"}`}>{item.entityType}</span></td>
          <td>{fmtD(item.dueDate)}</td><td style={{fontSize:12,color:"var(--t2)"}}>{item.notes}</td>
          <td><span className="tag tag-ok">Current</span></td>
        </tr>)}
      </tbody></table></div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// MARKETING
// ═══════════════════════════════════════════════════════════════════════
function MarketingPage({campaigns,setCampaigns,leads,applicants}){
  const totalBudget=campaigns.reduce((s,c)=>s+c.budget,0);
  const totalSpent=campaigns.reduce((s,c)=>s+c.spent,0);
  const totalLeads=campaigns.reduce((s,c)=>s+c.leads,0);
  const totalConv=campaigns.reduce((s,c)=>s+c.conversions,0);
  const avgCPL=totalLeads>0?(totalSpent/totalLeads):0;

  return <div>
    <div className="hdr"><div><h2>Marketing</h2><div className="hdr-sub">Campaigns, leads, and growth analytics</div></div></div>

    <div className="sg">
      <div className="sc bl"><span className="sl">Total Budget</span><span className="sv">{$(totalBudget)}</span><span className="ss">{$(totalSpent)} spent ({totalBudget>0?((totalSpent/totalBudget)*100).toFixed(0):0}%)</span></div>
      <div className="sc pu"><span className="sl">Total Leads</span><span className="sv">{totalLeads}</span><span className="ss">{totalConv} converted</span></div>
      <div className="sc ok"><span className="sl">Conversion Rate</span><span className="sv">{totalLeads>0?((totalConv/totalLeads)*100).toFixed(0):0}%</span><span className="ss">{totalConv} of {totalLeads}</span></div>
      <div className="sc wn"><span className="sl">Avg Cost/Lead</span><span className="sv">{$(avgCPL)}</span><span className="ss">Across all channels</span></div>
    </div>

    <div className="ai-card">
      <h4><span className="pulse" style={{background:"var(--ok)"}}/>Marketing Intelligence</h4>
      <p>
        Hospital discharge partnerships are your best channel: {campaigns.find(c=>c.channel==="Direct Outreach")?.conversions||0} conversions at $0 cost per lead.
        Facebook/Instagram generating {campaigns.find(c=>c.channel==="Facebook/Instagram")?.leads||0} leads at {$(campaigns.find(c=>c.channel==="Facebook/Instagram")?.cpl||0)} CPL.
        Referral program yielding high-quality leads but at higher cost. Recommend increasing hospital outreach budget and launching Google Ads for "home care near me" searches.
      </p>
    </div>

    {/* Campaign Cards */}
    {campaigns.map(c=> <div key={c.id} className="card card-b">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div><div style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:400}}>{c.name}</div><div style={{fontSize:12,color:"var(--t2)"}}>{c.channel} • {fmtD(c.startDate)} — {fmtD(c.endDate)}</div></div>
        <span className={`tag ${c.status==="active"?"tag-ok":"tag-wn"}`}>{c.status}</span>
      </div>

      {/* Budget Bar */}
      {c.budget>0&& <div style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t2)",marginBottom:4}}><span>Budget: {$(c.budget)}</span><span>Spent: {$(c.spent)} ({((c.spent/c.budget)*100).toFixed(0)}%)</span></div>
        <div className="progress-bar"><div className="progress-fill" style={{width:`${Math.min((c.spent/c.budget)*100,100)}%`,background:c.spent>c.budget?"var(--err)":"var(--blue)"}}/></div>
      </div>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        <div style={{padding:10,background:"var(--bg)",borderRadius:"var(--rs)",textAlign:"center"}}><div style={{fontSize:10,color:"var(--t2)",textTransform:"uppercase"}}>Leads</div><div style={{fontFamily:"var(--fd)",fontWeight:900,fontSize:18}}>{c.leads}</div></div>
        <div style={{padding:10,background:"var(--bg)",borderRadius:"var(--rs)",textAlign:"center"}}><div style={{fontSize:10,color:"var(--t2)",textTransform:"uppercase"}}>Converted</div><div style={{fontFamily:"var(--fd)",fontWeight:900,fontSize:18,color:"var(--ok)"}}>{c.conversions}</div></div>
        <div style={{padding:10,background:"var(--bg)",borderRadius:"var(--rs)",textAlign:"center"}}><div style={{fontSize:10,color:"var(--t2)",textTransform:"uppercase"}}>Conv %</div><div style={{fontFamily:"var(--fd)",fontWeight:900,fontSize:18}}>{c.leads>0?((c.conversions/c.leads)*100).toFixed(0):0}%</div></div>
        <div style={{padding:10,background:"var(--bg)",borderRadius:"var(--rs)",textAlign:"center"}}><div style={{fontSize:10,color:"var(--t2)",textTransform:"uppercase"}}>CPL</div><div style={{fontFamily:"var(--fd)",fontWeight:900,fontSize:18}}>{$(c.cpl)}</div></div>
      </div>
      {c.notes&& <div style={{fontSize:12,color:"var(--t2)",marginTop:8,padding:"6px 10px",background:"var(--bg)",borderRadius:"var(--rs)"}}>{c.notes}</div>}
    </div>)}

    {/* Pipeline Summary */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div className="card"><div className="card-h"><h3>Caregiver Pipeline</h3></div><div className="card-b">
        <div style={{fontSize:13,lineHeight:2}}>
          <div><strong>{applicants.filter(a=>a.status==="new").length}</strong> new applicants</div>
          <div><strong>{applicants.filter(a=>a.status==="screening").length}</strong> in screening</div>
          <div><strong>{applicants.filter(a=>a.status==="interview").length}</strong> interviewing</div>
          <div><strong>{applicants.filter(a=>a.status==="offer").length}</strong> offers pending</div>
        </div>
      </div></div>
      <div className="card"><div className="card-h"><h3>Client Pipeline</h3></div><div className="card-b">
        <div style={{fontSize:13,lineHeight:2}}>
          <div><strong>{leads.filter(l=>l.status==="new").length}</strong> new leads</div>
          <div><strong>{leads.filter(l=>l.status==="inquiry").length}</strong> inquiries</div>
          <div><strong>{leads.filter(l=>l.status==="assessment").length}</strong> assessments scheduled</div>
          <div><strong>{leads.filter(l=>l.status==="proposal").length}</strong> proposals out</div>
        </div>
      </div></div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATIONS CENTER — Admin/Owner
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// FEATURE MANAGEMENT — Toggle features per client/caregiver
// ═══════════════════════════════════════════════════════════════════════
function FeatureManagementPage({featureFlags,setFeatureFlags,isFeatureEnabled,toggleFeature,clients,caregivers,logAction}){
  const [tab,setTab]=useState("global");
  const [selEntity,setSelEntity]=useState("");
  const cats=[...new Set(FEATURES.map(f=>f.cat))];

  const FeatureRow=({f,entityId,entityType})=>{
    const enabled=isFeatureEnabled(f.id,entityId);
    const overridden=entityId&&featureFlags[entityId]?.[f.id]!==undefined;
    const applies=!entityType||f.appliesTo.includes(entityType);
    if(!applies)return null;
    return <div style={{padding:"14px 18px",borderBottom:"var(--border-thin)",display:"flex",gap:14,alignItems:"center"}}>
      <div style={{fontSize:24,width:36,textAlign:"center"}}>{f.icon}</div>
      <div style={{flex:1}}>
        <div style={{fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
          {f.label}
          {overridden&&<span style={{fontSize:9,padding:"2px 6px",background:"var(--ochre)",color:"#fff"}}>OVERRIDE</span>}
        </div>
        <div style={{fontSize:11,color:"var(--t2)",marginTop:2}}>{f.desc}</div>
      </div>
      <label style={{position:"relative",display:"inline-block",width:46,height:24,cursor:"pointer"}}>
        <input type="checkbox" checked={enabled} onChange={()=>{toggleFeature(f.id,entityId);if(logAction)logAction("feature_toggle",entityId||"global","Toggled "+f.label+" to "+(!enabled?"ON":"OFF"));}} style={{opacity:0,width:0,height:0}}/>
        <span style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:enabled?"var(--ok)":"#ccc",transition:".2s"}}>
          <span style={{position:"absolute",height:18,width:18,left:enabled?25:3,top:3,background:"#fff",transition:".2s"}}/>
        </span>
      </label>
    </div>;
  };

  return <div>
    <div className="hdr"><div><h2>Feature Management</h2><div className="hdr-sub">Enable/disable features globally or per client/caregiver</div></div></div>

    <div className="tab-row">
      <button className={`tab-btn ${tab==="global"?"act":""}`} onClick={()=>setTab("global")}>🌐 Global Defaults</button>
      <button className={`tab-btn ${tab==="clients"?"act":""}`} onClick={()=>setTab("clients")}>👤 Per Client</button>
      <button className={`tab-btn ${tab==="caregivers"?"act":""}`} onClick={()=>setTab("caregivers")}>👩‍⚕️ Per Caregiver</button>
    </div>

    {tab==="global"&& <div>
      <div className="ai-card"><h4>🌐 Global Defaults</h4><p>These are the default settings for all clients and caregivers. Override individually using the Per-Client or Per-Caregiver tabs.</p></div>
      {cats.map(cat=> <div key={cat} className="card" style={{marginBottom:14}}>
        <div className="card-h"><h3>{cat==="AI"?"🤖 AI Features":cat==="Operations"?"⚙️ Operations":cat==="Compliance"?"🛡️ Compliance & Trust":cat==="Mobile"?"📱 Mobile & Accessibility":cat}</h3></div>
        {FEATURES.filter(f=>f.cat===cat).map(f=> <FeatureRow key={f.id} f={f} entityId={null}/>)}
      </div>)}
    </div>}

    {tab==="clients"&& <div>
      <div className="hdr" style={{marginBottom:8}}><div></div>
        <select value={selEntity} onChange={e=>setSelEntity(e.target.value)} style={{padding:"8px 12px",border:"var(--border-thin)",fontWeight:600,minWidth:240}}>
          <option value="">Select a client</option>
          {clients.filter(c=>c.status!=="archived").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {!selEntity&&<div className="empty">Select a client to manage their feature settings</div>}
      {selEntity&&<>
        <div className="ai-card"><h4>👤 {clients.find(c=>c.id===selEntity)?.name}</h4><p>Override global defaults for this client. Toggles in green are enabled. The OVERRIDE badge shows where this client differs from the global default.</p></div>
        {cats.map(cat=>{
          const feats=FEATURES.filter(f=>f.cat===cat&&f.appliesTo.includes("client"));
          if(feats.length===0)return null;
          return <div key={cat} className="card" style={{marginBottom:14}}>
            <div className="card-h"><h3>{cat==="AI"?"🤖 AI Features":cat==="Operations"?"⚙️ Operations":cat==="Compliance"?"🛡️ Compliance":cat==="Mobile"?"📱 Mobile":cat}</h3></div>
            {feats.map(f=> <FeatureRow key={f.id} f={f} entityId={selEntity} entityType="client"/>)}
          </div>;
        })}
      </>}
    </div>}

    {tab==="caregivers"&& <div>
      <div className="hdr" style={{marginBottom:8}}><div></div>
        <select value={selEntity} onChange={e=>setSelEntity(e.target.value)} style={{padding:"8px 12px",border:"var(--border-thin)",fontWeight:600,minWidth:240}}>
          <option value="">Select a caregiver</option>
          {caregivers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {!selEntity&&<div className="empty">Select a caregiver to manage their feature settings</div>}
      {selEntity&&<>
        <div className="ai-card"><h4>👩‍⚕️ {caregivers.find(c=>c.id===selEntity)?.name}</h4><p>Override global defaults for this caregiver. The OVERRIDE badge shows where this caregiver differs from the global default.</p></div>
        {cats.map(cat=>{
          const feats=FEATURES.filter(f=>f.cat===cat&&f.appliesTo.includes("caregiver"));
          if(feats.length===0)return null;
          return <div key={cat} className="card" style={{marginBottom:14}}>
            <div className="card-h"><h3>{cat==="AI"?"🤖 AI Features":cat==="Operations"?"⚙️ Operations":cat==="Compliance"?"🛡️ Compliance":cat==="Mobile"?"📱 Mobile":cat}</h3></div>
            {feats.map(f=> <FeatureRow key={f.id} f={f} entityId={selEntity} entityType="caregiver"/>)}
          </div>;
        })}
      </>}
    </div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// LIVE GPS MAP — Real-time caregiver locations
// ═══════════════════════════════════════════════════════════════════════
function LiveGPSMapPage({caregivers,clients,schedules,livePositions}){
  const today_=today();
  const todayShifts=(schedules||[]).filter(s=>s.date===today_&&s.status==="published");
  const [selCG,setSelCG]=useState(null);

  // Mock live positions if none set
  const mockPositions={
    CG1:{lat:41.9034,lng:-87.6276,accuracy:8,timestamp:Date.now()-120000,address:"Near 30 E Elm St, Chicago",speed:0,status:"on_shift"},
    CG2:{lat:41.9421,lng:-87.6516,accuracy:12,timestamp:Date.now()-340000,address:"Near 3930 N Pine Grove Ave",speed:0,status:"on_shift"},
    CG3:{lat:41.9742,lng:-87.6502,accuracy:15,timestamp:Date.now()-90000,address:"En route to Steven Brown's",speed:25,status:"traveling"},
    CG4:{lat:41.8851,lng:-87.6228,accuracy:20,timestamp:Date.now()-1200000,address:"Off duty - Loop area",speed:0,status:"off_duty"},
  };
  const positions={...mockPositions,...livePositions};

  return <div>
    <div className="hdr"><div><h2>Live GPS Map</h2><div className="hdr-sub">Real-time caregiver locations · Last updated {new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div></div>
      <button className="btn btn-sm btn-s" onClick={()=>window.location.reload()}>🔄 Refresh</button>
    </div>

    <div className="sg">
      <div className="sc ok"><span className="sl">On Shift</span><span className="sv">{caregivers.filter(c=>positions[c.id]?.status==="on_shift").length}</span><span className="ss">Active right now</span></div>
      <div className="sc bl"><span className="sl">Traveling</span><span className="sv">{caregivers.filter(c=>positions[c.id]?.status==="traveling").length}</span><span className="ss">En route to client</span></div>
      <div className="sc"><span className="sl">Off Duty</span><span className="sv">{caregivers.filter(c=>positions[c.id]?.status==="off_duty"||!positions[c.id]).length}</span><span className="ss">Not working</span></div>
      <div className="sc wn"><span className="sl">Today's Shifts</span><span className="sv">{todayShifts.length}</span><span className="ss">{todayShifts.filter(s=>positions[s.caregiverId]?.status==="on_shift").length} in progress</span></div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:14}}>
      {/* Caregiver List */}
      <div className="card" style={{maxHeight:600,overflow:"auto"}}>
        <div className="card-h"><h3>Caregivers ({caregivers.length})</h3></div>
        {caregivers.map(cg=>{const pos=positions[cg.id];const minsAgo=pos?Math.floor((Date.now()-pos.timestamp)/60000):null;return <div key={cg.id} onClick={()=>setSelCG(cg.id)} style={{padding:"12px 16px",borderBottom:"var(--border-thin)",cursor:"pointer",background:selCG===cg.id?"var(--bg)":"transparent"}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:pos?.status==="on_shift"?"var(--ok)":pos?.status==="traveling"?"var(--blue)":"#999",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13}}>{cg.name}</div>
              {pos?<div style={{fontSize:10,color:"var(--t2)"}}>{pos.address}</div>:<div style={{fontSize:10,color:"var(--t2)"}}>No GPS data</div>}
              {minsAgo!=null&&<div style={{fontSize:10,color:minsAgo>10?"var(--err)":"var(--t2)"}}>{minsAgo<1?"Just now":minsAgo+" min ago"}</div>}
            </div>
          </div>
        </div>;})}
      </div>

      {/* Map View (visual representation since we can't load real maps in artifact) */}
      <div className="card" style={{minHeight:600,position:"relative",background:"linear-gradient(135deg,#e8f0e8 0%,#d4e0d4 100%)",overflow:"hidden"}}>
        <div style={{position:"absolute",top:10,left:10,background:"#fff",padding:"6px 12px",fontSize:11,fontWeight:600,zIndex:10}}>Chicago Metro Area</div>
        {/* Mock map dots */}
        {caregivers.map(cg=>{const pos=positions[cg.id];if(!pos)return null;
          // Mock x/y based on lat/lng (offset from center)
          const x=((pos.lng+87.65)*1500)+50;const y=((-pos.lat+41.95)*1500)+50;
          return <div key={cg.id} onClick={()=>setSelCG(cg.id)} style={{position:"absolute",left:x+"px",top:y+"px",cursor:"pointer",zIndex:selCG===cg.id?20:5}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:pos.status==="on_shift"?"var(--ok)":pos.status==="traveling"?"var(--blue)":"#999",border:"3px solid #fff",boxShadow:"0 2px 8px rgba(0,0,0,.3)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:11}}>{cg.name.split(" ").map(n=>n[0]).join("")}</div>
            {selCG===cg.id&&<div style={{position:"absolute",top:38,left:-80,width:200,background:"#fff",padding:"10px 12px",border:"var(--border-thin)",fontSize:11,boxShadow:"0 4px 16px rgba(0,0,0,.15)"}}>
              <div style={{fontWeight:700,marginBottom:4}}>{cg.name}</div>
              <div style={{color:"var(--t2)"}}>{pos.address}</div>
              <div style={{color:"var(--t2)",marginTop:4}}>Status: {pos.status.replace("_"," ")}</div>
              <div style={{color:"var(--t2)"}}>Speed: {pos.speed||0} mph</div>
              <div style={{color:"var(--t2)"}}>Updated {Math.floor((Date.now()-pos.timestamp)/60000)} min ago</div>
            </div>}
          </div>;
        })}
        {/* Client markers */}
        {clients.filter(c=>c.status==="active").map((cl,i)=>{const x=200+i*120;const y=350;return <div key={cl.id} style={{position:"absolute",left:x+"px",top:y+"px"}}>
          <div style={{width:24,height:24,background:"#070707",color:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>🏠</div>
          <div style={{fontSize:9,fontWeight:600,marginTop:2,whiteSpace:"nowrap"}}>{cl.name.split(" ")[0]}</div>
        </div>;})}
        <div style={{position:"absolute",bottom:10,left:10,background:"#fff",padding:"8px 12px",fontSize:10,display:"flex",gap:14}}>
          <span>🟢 On Shift</span><span>🔵 Traveling</span><span>⚪ Off Duty</span><span>🏠 Client</span>
        </div>
      </div>
    </div>

    <div style={{marginTop:14,padding:"12px 16px",background:"var(--bg)",fontSize:11,color:"var(--t2)"}}>
      <strong>Note:</strong> Real-time GPS requires caregivers to enable location sharing on their mobile device during shifts. This view shows mock positions for demo purposes. Production version uses caregiver phone GPS with 30-second refresh.
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// SUPPLY TRACKING
// ═══════════════════════════════════════════════════════════════════════
function SupplyPage({supplies,setSupplies,clients}){
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({clientId:"",item:"",qty:0,reorderAt:0});
  const lowSupplies=supplies.filter(s=>s.qty<=s.reorderAt);

  return <div>
    <div className="hdr"><div><h2>Supply Tracking</h2><div className="hdr-sub">Inventory and auto-reorder alerts</div></div>
      <button className="btn btn-p btn-sm" onClick={()=>{setForm({clientId:"",item:"",qty:0,reorderAt:0});setShowAdd(true);}}>+ Add Supply</button>
    </div>

    <div className="sg">
      <div className="sc ok"><span className="sl">Total Items</span><span className="sv">{supplies.length}</span></div>
      <div className="sc er"><span className="sl">Low Stock</span><span className="sv">{lowSupplies.length}</span><span className="ss">Need reorder</span></div>
      <div className="sc bl"><span className="sl">Clients Tracked</span><span className="sv">{[...new Set(supplies.map(s=>s.clientId))].length}</span></div>
    </div>

    {lowSupplies.length>0&&<div className="ai-card" style={{background:"linear-gradient(135deg,#3d0000,#1a0000)",color:"#fff"}}>
      <h4>⚠️ Reorder Alert</h4>
      <p>{lowSupplies.length} item{lowSupplies.length>1?"s":""} below reorder threshold: {lowSupplies.map(s=>{const c=clients.find(cl=>cl.id===s.clientId);return s.item+" ("+c?.name+")"}).join(", ")}</p>
    </div>}

    {clients.filter(c=>c.status==="active").map(cl=>{const cs=supplies.filter(s=>s.clientId===cl.id);if(cs.length===0)return null;return <div key={cl.id} className="card" style={{marginBottom:14}}>
      <div className="card-h"><h3>{cl.name}</h3></div>
      <div className="tw"><table><thead><tr><th>Item</th><th>Qty on Hand</th><th>Reorder At</th><th>Status</th><th>Last Ordered</th><th>Actions</th></tr></thead><tbody>
        {cs.map(s=>{const low=s.qty<=s.reorderAt;return <tr key={s.id}>
          <td style={{fontWeight:600}}>{s.item}</td>
          <td><input type="number" value={s.qty} onChange={e=>setSupplies(p=>p.map(x=>x.id===s.id?{...x,qty:parseInt(e.target.value)||0}:x))} style={{width:70}}/></td>
          <td><input type="number" value={s.reorderAt} onChange={e=>setSupplies(p=>p.map(x=>x.id===s.id?{...x,reorderAt:parseInt(e.target.value)||0}:x))} style={{width:70}}/></td>
          <td><span className={`tag ${low?"tag-er":"tag-ok"}`}>{low?"⚠️ LOW":"✓ OK"}</span></td>
          <td>{fmtD(s.lastOrdered)}</td>
          <td><div style={{display:"flex",gap:4}}>
            <button className="btn btn-sm btn-s" onClick={()=>{setForm({clientId:s.clientId,item:s.item,qty:s.qty,reorderAt:s.reorderAt,id:s.id});setShowAdd(true);}}>✏️ Edit</button>
            {low&&<button className="btn btn-sm btn-ok" onClick={()=>setSupplies(p=>p.map(x=>x.id===s.id?{...x,qty:x.qty+50,lastOrdered:today()}:x))}>📦 Reorder</button>}
            <button className="btn btn-sm btn-s" style={{color:"var(--err)"}} onClick={()=>{if(confirm("Delete "+s.item+"?"))setSupplies(p=>p.filter(x=>x.id!==s.id));}}>🗑</button>
          </div></td>
        </tr>;})}
      </tbody></table></div>
    </div>;})}

    {showAdd&&<div className="modal-bg" onClick={()=>setShowAdd(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">{form.id?"Edit Supply":"Add Supply"}<button className="btn btn-sm btn-s" onClick={()=>setShowAdd(false)}>✕</button></div>
      <div className="modal-b">
        <div className="fi" style={{marginBottom:10}}><label>Client</label><select value={form.clientId} onChange={e=>setForm(p=>({...p,clientId:e.target.value}))}><option value="">Select</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="fi" style={{marginBottom:10}}><label>Item Name</label><input value={form.item} onChange={e=>setForm(p=>({...p,item:e.target.value}))} placeholder="e.g. Gloves (medium)"/></div>
        <div className="fg" style={{marginBottom:10}}>
          <div className="fi"><label>Current Qty</label><input type="number" value={form.qty} onChange={e=>setForm(p=>({...p,qty:parseInt(e.target.value)||0}))}/></div>
          <div className="fi"><label>Reorder At</label><input type="number" value={form.reorderAt} onChange={e=>setForm(p=>({...p,reorderAt:parseInt(e.target.value)||0}))}/></div>
        </div>
        <button className="btn btn-p" style={{width:"100%"}} disabled={!form.clientId||!form.item} onClick={()=>{
          if(form.id){setSupplies(p=>p.map(x=>x.id===form.id?{...x,clientId:form.clientId,item:form.item,qty:form.qty,reorderAt:form.reorderAt}:x));}
          else{setSupplies(p=>[...p,{id:"SP"+uid(),...form,lastOrdered:today()}]);}
          setShowAdd(false);
          setForm({clientId:"",item:"",qty:0,reorderAt:0});
        }}>{form.id?"Save Changes":"Add Supply"}</button>
      </div>
    </div></div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// SHIFT SWAP REQUESTS
// ═══════════════════════════════════════════════════════════════════════
function ShiftSwapPage({swapRequests,setSwapRequests,caregivers,clients,schedules,setSchedules,notify}){
  const [showNew,setShowNew]=useState(false);
  const [form,setForm]=useState({scheduleId:"",reason:"",notes:""});
  const open=swapRequests.filter(s=>s.status==="open");
  const completed=swapRequests.filter(s=>s.status!=="open");

  // AI: Find qualified replacements
  const findReplacements=(req)=>{
    const sched=schedules.find(s=>s.id===req.scheduleId);
    if(!sched)return[];
    return caregivers.filter(c=>c.id!==sched.caregiverId).map(c=>{
      let score=50;
      // Mock scoring based on certs
      if(c.certs?.length>=3)score+=20;
      if(c.certs?.length>=2)score+=10;
      // Mock availability check
      const conflicts=schedules.filter(s=>s.caregiverId===c.id&&s.date===sched.date);
      if(conflicts.length>0)score-=30;
      return{caregiver:c,score:Math.max(0,Math.min(100,score)),available:conflicts.length===0};
    }).sort((a,b)=>b.score-a.score);
  };

  return <div>
    <div className="hdr"><div><h2>Shift Swap Requests</h2><div className="hdr-sub">Smart matching with qualified replacements</div></div>
      <button className="btn btn-p btn-sm" onClick={()=>{setForm({scheduleId:"",reason:"",notes:""});setShowNew(true);}}>+ New Swap Request</button>
    </div>

    <div className="sg">
      <div className="sc wn"><span className="sl">Open Requests</span><span className="sv">{open.length}</span></div>
      <div className="sc ok"><span className="sl">Filled</span><span className="sv">{completed.filter(s=>s.status==="filled").length}</span></div>
      <div className="sc"><span className="sl">Cancelled</span><span className="sv">{completed.filter(s=>s.status==="cancelled").length}</span></div>
    </div>

    {open.length===0&&completed.length===0&&<div className="empty">No swap requests yet. Caregivers can request swaps when they need coverage.</div>}

    {open.map(req=>{const sched=schedules.find(s=>s.id===req.scheduleId);const cg=caregivers.find(c=>c.id===sched?.caregiverId);const cl=clients.find(c=>c.id===sched?.clientId);const replacements=findReplacements(req);return <div key={req.id} className="card card-b" style={{marginBottom:14,borderLeft:"4px solid var(--warn)"}}>
      <div className="card-h"><h3>{cg?.name} → needs swap for {cl?.name} on {fmtD(sched?.date)}</h3></div>
      <div style={{padding:"12px 18px"}}>
        <div style={{fontSize:12,color:"var(--t2)",marginBottom:8}}>
          <strong>Shift:</strong> {sched?.startTime} - {sched?.endTime}<br/>
          <strong>Reason:</strong> {req.reason}<br/>
          {req.notes&&<><strong>Notes:</strong> {req.notes}</>}
        </div>
        <div style={{marginTop:12}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>🤖 AI-Suggested Replacements</div>
          {replacements.slice(0,4).map(r=><div key={r.caregiver.id} style={{padding:"10px 12px",borderBottom:"var(--border-thin)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:600,fontSize:13}}>{r.caregiver.name} <span style={{background:r.score>=75?"var(--ok)":r.score>=50?"var(--warn)":"var(--err)",color:"#fff",padding:"1px 6px",fontSize:10,marginLeft:6}}>{r.score}/100</span></div>
              <div style={{fontSize:11,color:"var(--t2)"}}>{r.caregiver.certs?.join(", ")} {!r.available&&"⚠️ Has conflicting shift"}</div>
            </div>
            {r.available&&<button className="btn btn-sm btn-ok" onClick={()=>{
              setSchedules(p=>p.map(s=>s.id===req.scheduleId?{...s,caregiverId:r.caregiver.id}:s));
              setSwapRequests(p=>p.map(x=>x.id===req.id?{...x,status:"filled",replacedBy:r.caregiver.id,filledAt:now().toISOString()}:x));
              if(notify)notify("U1","schedule_change","Shift Swap Filled",cg?.name+" → "+r.caregiver.name+" for "+cl?.name+" on "+fmtD(sched?.date),{});
            }}>✓ Assign to {r.caregiver.name.split(" ")[0]}</button>}
          </div>)}
        </div>
        <div style={{display:"flex",gap:6,marginTop:12}}>
          <button className="btn btn-sm btn-s" onClick={()=>setSwapRequests(p=>p.map(x=>x.id===req.id?{...x,status:"cancelled"}:x))}>Cancel Request</button>
        </div>
      </div>
    </div>;})}

    {completed.length>0&&<details><summary style={{cursor:"pointer",fontSize:12,color:"var(--t2)",fontWeight:600,padding:"10px 0"}}>Completed ({completed.length})</summary>
      {completed.map(req=>{const sched=schedules.find(s=>s.id===req.scheduleId);const cg=caregivers.find(c=>c.id===req.replacedBy);return <div key={req.id} style={{padding:"10px 16px",borderBottom:"var(--border-thin)",fontSize:12,opacity:.7}}>
        <span className={`tag ${req.status==="filled"?"tag-ok":"tag-er"}`}>{req.status}</span> Schedule {sched?.id} {req.status==="filled"&&"→ "+cg?.name}
      </div>;})}
    </details>}

    {showNew&&<div className="modal-bg" onClick={()=>setShowNew(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">New Swap Request<button className="btn btn-sm btn-s" onClick={()=>setShowNew(false)}>✕</button></div>
      <div className="modal-b">
        <div className="fi" style={{marginBottom:10}}><label>Schedule</label><select value={form.scheduleId} onChange={e=>setForm(p=>({...p,scheduleId:e.target.value}))}><option value="">Select shift</option>{schedules.filter(s=>s.status==="published"&&new Date(s.date)>=now()).map(s=>{const cg=caregivers.find(c=>c.id===s.caregiverId);const cl=clients.find(c=>c.id===s.clientId);return <option key={s.id} value={s.id}>{fmtD(s.date)} {s.startTime} — {cg?.name} for {cl?.name}</option>;})}</select></div>
        <div className="fi" style={{marginBottom:10}}><label>Reason</label><select value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))}><option>Personal emergency</option><option>Sick</option><option>Family obligation</option><option>Schedule conflict</option><option>Other</option></select></div>
        <div className="fi" style={{marginBottom:10}}><label>Notes</label><textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={3} style={{width:"100%"}}/></div>
        <button className="btn btn-p" style={{width:"100%"}} disabled={!form.scheduleId} onClick={()=>{setSwapRequests(p=>[{id:"SW"+uid(),...form,status:"open",createdAt:now().toISOString()},...p]);setShowNew(false);}}>Submit Request</button>
      </div>
    </div></div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// AUDIT LOG VIEWER
// ═══════════════════════════════════════════════════════════════════════
function AuditLogPage({auditLog,clients,caregivers,allUsers}){
  const [filter,setFilter]=useState("");
  const [actionFilter,setActionFilter]=useState("all");
  const filtered=auditLog.filter(a=>{
    if(actionFilter!=="all"&&a.action!==actionFilter)return false;
    if(filter&&!JSON.stringify(a).toLowerCase().includes(filter.toLowerCase()))return false;
    return true;
  });
  const actions=[...new Set(auditLog.map(a=>a.action))];

  return <div>
    <div className="hdr"><div><h2>Audit Log</h2><div className="hdr-sub">{auditLog.length} actions logged · HIPAA-compliant trail</div></div></div>
    <div className="card" style={{marginBottom:14,padding:"10px 16px",display:"flex",gap:10,alignItems:"center"}}>
      <input placeholder="Search log..." value={filter} onChange={e=>setFilter(e.target.value)} style={{flex:1}}/>
      <select value={actionFilter} onChange={e=>setActionFilter(e.target.value)}><option value="all">All actions</option>{actions.map(a=><option key={a}>{a}</option>)}</select>
    </div>
    <div className="card">
      <div className="card-h"><h3>Activity Timeline ({filtered.length})</h3></div>
      {filtered.length===0&&<div className="empty">No log entries match your filter</div>}
      {filtered.slice(0,200).map(a=>{return <div key={a.id} style={{padding:"10px 16px",borderBottom:"var(--border-thin)",display:"flex",gap:14,fontSize:12}}>
        <div style={{minWidth:140,fontSize:11,color:"var(--t2)"}}>{new Date(a.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})} {new Date(a.date).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
        <div style={{minWidth:120,fontWeight:600}}>{a.user}</div>
        <div style={{minWidth:140}}><span className="tag tag-bl">{a.action}</span></div>
        <div style={{flex:1,color:"var(--t2)"}}>{a.detail}</div>
      </div>;})}
    </div>
  </div>;
}

function NotificationsPage({notifications,setNotifications,allUsers,clients,caregivers,incidents,setIncidents,expenses,setExpenses}){
  const [filter,setFilter]=useState("all");
  const filtered=filter==="all"?notifications:notifications.filter(n=>n.type===filter);
  const markRead=(id)=>setNotifications(p=>p.map(n=>n.id===id?{...n,read:true}:n));
  const markAllRead=()=>setNotifications(p=>p.map(n=>({...n,read:true})));
  const types=[...new Set(notifications.map(n=>n.type))];

  // Incident approval
  const approveIncidentForClient=(incId)=>setIncidents(p=>p.map(i=>i.id===incId?{...i,visibleToClient:true,adminApproved:true}:i));
  // Expense approval
  const approveExpense=(exId)=>setExpenses(p=>p.map(e=>e.id===exId?{...e,status:"approved",adminApproved:true}:e));
  const rejectExpense=(exId)=>setExpenses(p=>p.map(e=>e.id===exId?{...e,status:"rejected"}:e));

  return <div>
    <div className="hdr"><div><h2>Notifications</h2><div className="hdr-sub">{notifications.length} total | {notifications.filter(n=>!n.read).length} unread</div></div>
      <button className="btn btn-sm btn-s" onClick={markAllRead}>Mark All Read</button>
    </div>

    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      <button className={`btn btn-sm ${filter==="all"?"btn-p":"btn-s"}`} onClick={()=>setFilter("all")}>All ({notifications.length})</button>
      {types.map(t=> <button key={t} className={`btn btn-sm ${filter===t?"btn-p":"btn-s"}`} onClick={()=>setFilter(t)}>{t.replace(/_/g," ")} ({notifications.filter(n=>n.type===t).length})</button>)}
    </div>

    {filtered.length===0&& <div className="card card-b empty">No notifications</div>}
    {filtered.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(n=>{
      const isInc=n.type==="incident";const isExp=n.type==="expense";
      const inc=isInc?incidents.find(i=>i.id===n.meta?.incidentId):null;
      const exp=isExp?expenses.find(e=>e.id===n.meta?.expenseId):null;
      return <div key={n.id} style={{padding:"14px 20px",borderBottom:"var(--border-thin)",background:n.read?"var(--card)":"rgba(138,115,86,.04)",cursor:"pointer"}} onClick={()=>markRead(n.id)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {!n.read&&<div style={{width:6,height:6,borderRadius:"50%",background:"#8a7356",flexShrink:0}}/>}
            <span style={{fontSize:13,fontWeight:600}}>{n.title}</span>
            <span className={`tag ${n.type==="incident"?"tag-er":n.type==="expense"?"tag-wn":n.type==="running_late"?"tag-wn":"tag-bl"}`} style={{fontSize:8}}>{n.type.replace(/_/g," ")}</span>
          </div>
          <span style={{fontSize:10,color:"var(--t2)",flexShrink:0}}>{fmtRel(n.date)}</span>
        </div>
        <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.6}}>{n.body}</div>

        {/* Incident approval action */}
        {isInc&&inc&&!inc.visibleToClient&& <div style={{display:"flex",gap:6,marginTop:10}}>
          <button className="btn btn-sm btn-ok" onClick={e=>{e.stopPropagation();approveIncidentForClient(inc.id);}}>✓ Show to Client/Family</button>
          <button className="btn btn-sm btn-s" onClick={e=>e.stopPropagation()}>Keep Admin Only</button>
        </div>}
        {isInc&&inc&&inc.visibleToClient&& <span className="tag tag-ok" style={{marginTop:8,display:"inline-flex"}}>Visible to client</span>}

        {/* Expense approval action */}
        {isExp&&exp&&exp.status==="pending"&& <div style={{display:"flex",gap:6,marginTop:10}}>
          <button className="btn btn-sm btn-ok" onClick={e=>{e.stopPropagation();approveExpense(exp.id);}}>✓ Approve ${exp.amount.toFixed(2)}</button>
          <button className="btn btn-sm btn-er" onClick={e=>{e.stopPropagation();rejectExpense(exp.id);}}>✕ Reject</button>
        </div>}
        {isExp&&exp&&exp.status==="approved"&& <span className="tag tag-ok" style={{marginTop:8,display:"inline-flex"}}>Approved</span>}
        {isExp&&exp&&exp.status==="rejected"&& <span className="tag tag-er" style={{marginTop:8,display:"inline-flex"}}>Rejected</span>}
      </div>;
    })}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// INCIDENT AI SETTINGS — Admin-editable response templates
// ═══════════════════════════════════════════════════════════════════════
function IncidentSettingsPage({prompts,setPrompts}){
  const [editing,setEditing]=useState(null);
  const [editData,setEditData]=useState({immediate:"",report:"",notify:""});

  const startEdit=(type)=>{setEditing(type);setEditData({...prompts[type]});};
  const saveEdit=()=>{setPrompts(p=>({...p,[editing]:editData}));setEditing(null);};

  return <div>
    <div className="hdr"><div><h2>AI Incident Response Settings</h2><div className="hdr-sub">Customize the instructions caregivers see when reporting incidents</div></div></div>

    <div className="ai-card">
      <h4><span className="pulse" style={{background:"var(--ok)"}}/>How This Works</h4>
      <p>When a caregiver submits an incident report, they immediately receive AI-generated response instructions based on the templates below. These instructions tell them exactly what to do, what to document, and who to notify. Edit any template to match your company's protocols.</p>
    </div>

    {Object.entries(prompts).map(([type,data])=> <div key={type} className="card" style={{marginBottom:12}}>
      <div className="card-h"><h3>{type}</h3><button className="btn btn-sm btn-s" onClick={()=>editing===type?setEditing(null):startEdit(type)}>{editing===type?"Cancel":"Edit"}</button></div>
      {editing===type? <div className="card-b">
        <div className="fi" style={{marginBottom:12}}><label>Immediate Actions (shown to caregiver in red)</label>
          <textarea rows={5} value={editData.immediate} onChange={e=>setEditData(p=>({...p,immediate:e.target.value}))} style={{width:"100%",padding:10,border:"var(--border-thin)",fontSize:12,fontFamily:"var(--f)",lineHeight:1.8}}/>
        </div>
        <div className="fi" style={{marginBottom:12}}><label>Documentation Required (shown in amber)</label>
          <textarea rows={3} value={editData.report} onChange={e=>setEditData(p=>({...p,report:e.target.value}))} style={{width:"100%",padding:10,border:"var(--border-thin)",fontSize:12,fontFamily:"var(--f)",lineHeight:1.8}}/>
        </div>
        <div className="fi" style={{marginBottom:12}}><label>Notification Requirements (shown in blue)</label>
          <textarea rows={2} value={editData.notify} onChange={e=>setEditData(p=>({...p,notify:e.target.value}))} style={{width:"100%",padding:10,border:"var(--border-thin)",fontSize:12,fontFamily:"var(--f)",lineHeight:1.8}}/>
        </div>
        <button className="btn btn-p" onClick={saveEdit}>Save Changes</button>
      </div>
      : <div className="card-b" style={{fontSize:12,lineHeight:1.7}}>
        <div style={{marginBottom:10}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:"var(--err)",letterSpacing:.5,marginBottom:4}}>Immediate</div><div style={{color:"var(--t2)"}}>{data.immediate.slice(0,200)}{data.immediate.length>200?"...":""}</div></div>
        <div style={{marginBottom:10}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:"#8a7356",letterSpacing:.5,marginBottom:4}}>Document</div><div style={{color:"var(--t2)"}}>{data.report.slice(0,150)}{data.report.length>150?"...":""}</div></div>
        <div><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:"var(--blue)",letterSpacing:.5,marginBottom:4}}>Notify</div><div style={{color:"var(--t2)"}}>{data.notify}</div></div>
      </div>}
    </div>)}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// RATE CARDS — Client Bill Rates & Caregiver Pay Rates
// ═══════════════════════════════════════════════════════════════════════
function RateCardsPage({rateCards,setRateCards,payCards,setPayCards,clients,caregivers}){
  const [editRC,setEditRC]=useState(null);
  const [editPC,setEditPC]=useState(null);

  return <div>
    <div className="hdr"><div><h2>Rate Cards</h2><div className="hdr-sub">Client billing rates and caregiver pay rates</div></div></div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      {/* Client Bill Rates */}
      <div className="card">
        <div className="card-h"><h3>Client Bill Rates</h3></div>
        {rateCards.map((rc,i)=>{const cl=clients.find(c=>c.id===rc.clientId);return <div key={i} style={{padding:"14px 20px",borderBottom:"var(--border-thin)"}}>
          {editRC===i? <div>
            <div className="fg" style={{marginBottom:10}}>
              <div className="fi"><label>Bill Rate ($/hr)</label><input type="number" value={rc.billRate} onChange={e=>setRateCards(p=>p.map((r,j)=>j===i?{...r,billRate:+e.target.value}:r))} step="0.5"/></div>
              <div className="fi"><label>OT Rate ($/hr)</label><input type="number" value={rc.otRate} onChange={e=>setRateCards(p=>p.map((r,j)=>j===i?{...r,otRate:+e.target.value}:r))} step="0.5"/></div>
              <div className="fi"><label>OT Threshold (hrs/wk)</label><input type="number" value={rc.otThreshold} onChange={e=>setRateCards(p=>p.map((r,j)=>j===i?{...r,otThreshold:+e.target.value}:r))}/></div>
            </div>
            <div className="fi" style={{marginBottom:8}}><label>Notes</label><input value={rc.notes} onChange={e=>setRateCards(p=>p.map((r,j)=>j===i?{...r,notes:e.target.value}:r))}/></div>
            <button className="btn btn-sm btn-p" onClick={()=>setEditRC(null)}>Done</button>
          </div>
          : <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:600,fontSize:14}}>{cl?.name}</div><div style={{fontSize:12,color:"var(--t2)",marginTop:2}}>${rc.billRate}/hr | OT: ${rc.otRate}/hr after {rc.otThreshold}h</div>{rc.notes&&<div style={{fontSize:11,color:"var(--t2)",marginTop:2}}>{rc.notes}</div>}</div>
            <div style={{textAlign:"right"}}><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400}}>${rc.billRate}</div><button className="btn btn-sm btn-s" style={{marginTop:4}} onClick={()=>setEditRC(i)}>Edit</button></div>
          </div>}
        </div>;})}
      </div>

      {/* Caregiver Pay Rates */}
      <div className="card">
        <div className="card-h"><h3>Caregiver Pay Rates</h3></div>
        {payCards.map((pc,i)=>{const cg=caregivers.find(c=>c.id===pc.caregiverId);return <div key={i} style={{padding:"14px 20px",borderBottom:"var(--border-thin)"}}>
          {editPC===i? <div>
            <div className="fg" style={{marginBottom:10}}>
              <div className="fi"><label>Pay Rate ($/hr)</label><input type="number" value={pc.payRate} onChange={e=>setPayCards(p=>p.map((r,j)=>j===i?{...r,payRate:+e.target.value}:r))} step="0.5"/></div>
              <div className="fi"><label>OT Rate ($/hr)</label><input type="number" value={pc.otRate} onChange={e=>setPayCards(p=>p.map((r,j)=>j===i?{...r,otRate:+e.target.value}:r))} step="0.5"/></div>
              <div className="fi"><label>Type</label><select value={pc.type} onChange={e=>setPayCards(p=>p.map((r,j)=>j===i?{...r,type:e.target.value}:r))}><option value="employee">W-2 Employee</option><option value="contractor">1099 Contractor</option></select></div>
            </div>
            <div className="fi" style={{marginBottom:8}}><label>Notes</label><input value={pc.notes} onChange={e=>setPayCards(p=>p.map((r,j)=>j===i?{...r,notes:e.target.value}:r))}/></div>
            <button className="btn btn-sm btn-p" onClick={()=>setEditPC(null)}>Done</button>
          </div>
          : <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:600,fontSize:14}}>{cg?.name}</div>
              <div style={{fontSize:12,color:"var(--t2)",marginTop:2}}>${pc.payRate}/hr | OT: ${pc.otRate}/hr | <span className={`tag ${pc.type==="employee"?"tag-bl":"tag-wn"}`} style={{fontSize:8}}>{pc.type==="employee"?"W-2":"1099"}</span></div>
              {pc.notes&&<div style={{fontSize:11,color:"var(--t2)",marginTop:2}}>{pc.notes}</div>}</div>
            <div style={{textAlign:"right"}}><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400}}>${pc.payRate}</div><button className="btn btn-sm btn-s" style={{marginTop:4}} onClick={()=>setEditPC(i)}>Edit</button></div>
          </div>}
        </div>;})}
      </div>
    </div>

    {/* Margin Analysis */}
    <div className="card" style={{marginTop:14}}>
      <div className="card-h"><h3>Margin Analysis</h3></div>
      <div className="tw"><table><thead><tr><th>Client</th><th>Bill Rate</th><th>Caregivers</th><th>Avg Pay</th><th style={{textAlign:"right"}}>Margin/hr</th><th style={{textAlign:"right"}}>Margin %</th></tr></thead><tbody>
        {rateCards.map(rc=>{const cl=clients.find(c=>c.id===rc.clientId);const cgPay=payCards.filter(pc=>pc.caregiverId&&seedAssignments.some(a=>a.clientId===rc.clientId&&a.caregiverId===pc.caregiverId));const avgPay=cgPay.length>0?cgPay.reduce((s,p)=>s+p.payRate,0)/cgPay.length:0;const margin=rc.billRate-avgPay;const pct=rc.billRate>0?((margin/rc.billRate)*100).toFixed(0):0;
          return <tr key={rc.clientId}><td style={{fontWeight:600}}>{cl?.name}</td><td>${rc.billRate}/hr</td><td>{cgPay.map(p=>caregivers.find(c=>c.id===p.caregiverId)?.name).filter(Boolean).join(", ")||"—"}</td><td>${avgPay.toFixed(2)}/hr</td><td style={{textAlign:"right",fontWeight:700,color:"#3c4f3d"}}>${margin.toFixed(2)}</td><td style={{textAlign:"right"}}><span className={`tag ${+pct>=30?"tag-ok":"tag-wn"}`}>{pct}%</span></td></tr>;
        })}
      </tbody></table></div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// BILLING & INVOICES
// ═══════════════════════════════════════════════════════════════════════
function BillingPage({invoices,setInvoices,clients,caregivers,rateCards,billingPeriods,setBillingPeriods,schedules,expenses}){
  const [sel,setSel]=useState(null);
  const [showGen,setShowGen]=useState(false);
  const [genClient,setGenClient]=useState("");
  const [genPeriod,setGenPeriod]=useState(billingPeriods[0]?.id||"");
  const [posted,setPosted]=useState(false);

  const totalBilled=invoices.reduce((s,i)=>s+i.total,0);
  const totalPaid=invoices.filter(i=>i.status==="paid").reduce((s,i)=>s+i.total,0);
  const totalOutstanding=invoices.filter(i=>i.status==="sent").reduce((s,i)=>s+i.total,0);

  const generateInvoice=(clientId,periodId)=>{
    const period=billingPeriods.find(p=>p.id===periodId);if(!period)return;
    const cl=clients.find(c=>c.id===clientId);
    const rc=rateCards.find(r=>r.clientId===clientId);
    const rate=rc?.billRate||35;
    const shifts=(schedules||[]).filter(s=>s.clientId===clientId&&s.date>=period.start&&s.date<=period.end&&s.status==="published");
    const lines=shifts.map(s=>{const cg=caregivers.find(c=>c.id===s.caregiverId);const hrs=(timeToMin(s.endTime)-timeToMin(s.startTime))/60;const toAMPM=(t)=>{const[h,m]=t.split(":");const hr=parseInt(h);return(hr>12?hr-12:hr||12)+":"+m+" "+(hr>=12?"PM":"AM");};return{date:s.date,caregiver:cg?.name||"—",hours:hrs,rate,total:hrs*rate,signIn:toAMPM(s.startTime),signOut:toAMPM(s.endTime),startTime:s.startTime,endTime:s.endTime,notes:s.tasks?.slice(0,2).join(", ")||""};});
    const subtotal=lines.reduce((s,l)=>s+l.total,0);
    const clExp=expenses.filter(e=>e.clientId===clientId&&e.date>=period.start&&e.date<=period.end&&(e.status==="approved"||e.adminApproved));
    const expTotal=clExp.reduce((s,e)=>s+e.amount,0);
    const inv={id:`INV-${now().getFullYear()}-${String(invoices.length+1).padStart(3,"0")}`,clientId,periodId,date:today(),dueDate:toISO(addDays(now(),15)),status:"draft",lines,subtotal,expenses:expTotal,tax:0,total:subtotal+expTotal,lateFee:0,prevBalance:0,lastPayment:""};
    setInvoices(p=>[inv,...p]);setShowGen(false);
  };

  return <div>
    <div className="hdr"><div><h2>Billing & Invoices</h2><div className="hdr-sub">Generate and manage client invoices</div></div>
      <button className="btn btn-p btn-sm" onClick={()=>setShowGen(true)}>+ Generate Invoice</button>
    </div>

    <div className="sg">
      <div className="sc ok"><span className="sl">Total Billed</span><span className="sv">{$(totalBilled)}</span><span className="ss">{invoices.length} invoices</span></div>
      <div className="sc bl"><span className="sl">Paid</span><span className="sv">{$(totalPaid)}</span><span className="ss">{invoices.filter(i=>i.status==="paid").length} invoices</span></div>
      <div className="sc wn"><span className="sl">Outstanding</span><span className="sv">{$(totalOutstanding)}</span><span className="ss">{invoices.filter(i=>i.status==="sent").length} awaiting</span></div>
      <div className="sc"><span className="sl">Draft</span><span className="sv">{invoices.filter(i=>i.status==="draft").length}</span><span className="ss">not yet sent</span></div>
    </div>

    {/* Billing Periods */}
    <div className="card" style={{marginBottom:14}}>
      <div className="card-h"><h3>Bi-Weekly Pay Periods</h3></div>
      {billingPeriods.map(bp=> <div key={bp.id} style={{padding:"12px 20px",borderBottom:"var(--border-thin)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{flex:1,minWidth:200}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
            <span style={{fontWeight:700,fontSize:14}}>{bp.label}</span>
            {bp.weekNumbers&&<span className="tag tag-bl" style={{fontSize:10}}>Week {bp.weekNumbers.join(" & ")}</span>}
          </div>
          <div style={{fontSize:11,color:"var(--t2)",lineHeight:1.6}}>
            <strong>Period:</strong> {fmtD(bp.start)} — {fmtD(bp.end)}
            {bp.payDate&&<> · <strong>💵 Pay Day:</strong> {fmtD(bp.payDate)}</>}
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <span className={`tag ${bp.status==="open"?"tag-ok":"tag-bl"}`}>{bp.status}</span>
          {bp.status==="open"&&<button className="btn btn-sm btn-s" onClick={()=>setBillingPeriods(p=>p.map(b=>b.id===bp.id?{...b,status:"closed"}:b))}>Close</button>}
        </div>
      </div>)}
    </div>

    {/* Invoice List */}
    <div className="card">
      <div className="card-h"><h3>Invoices</h3></div>
      <div className="tw"><table><thead><tr><th>Invoice #</th><th>Client</th><th>Pay Period</th><th>Sent</th><th>Due</th><th>Late Fee Status</th><th style={{textAlign:"right"}}>Total</th><th>Status</th><th></th></tr></thead><tbody>
        {invoices.sort((a,b)=>b.date.localeCompare(a.date)).map(inv=>{
          const cl=clients.find(c=>c.id===inv.clientId);
          const period=billingPeriods.find(b=>b.id===inv.periodId);
          // Calculate days until late fee (7 days after due date)
          const dueDate=new Date(inv.dueDate);
          const lateFeeDate=new Date(dueDate);lateFeeDate.setDate(lateFeeDate.getDate()+7);
          const daysUntilLate=Math.ceil((lateFeeDate-now())/(1000*60*60*24));
          const isPaid=inv.status==="paid";
          const isOverdue=!isPaid&&daysUntilLate<=0;
          return <tr key={inv.id}>
            <td style={{fontWeight:700,fontFamily:"monospace"}}>{inv.id}</td>
            <td style={{fontWeight:600}}>{cl?.name}</td>
            <td style={{fontSize:11}}>
              {period?<><div>{period.label}</div>{period.weekNumbers&&<div style={{color:"var(--t2)"}}>Wk {period.weekNumbers.join(" & ")}</div>}</>:"—"}
            </td>
            <td style={{fontSize:11}}>{fmtD(inv.date)}</td>
            <td style={{fontSize:11}}>{fmtD(inv.dueDate)}</td>
            <td style={{fontSize:11}}>
              {isPaid?<span className="tag tag-ok">No fee</span>
              :isOverdue?<span className="tag tag-er">⚠️ Late fee applies (+$30)</span>
              :daysUntilLate<=3?<span className="tag tag-er">{daysUntilLate}d until late fee</span>
              :daysUntilLate<=7?<span className="tag tag-wn">{daysUntilLate}d until late fee</span>
              :<span className="tag tag-bl">{daysUntilLate}d until late fee</span>}
            </td>
            <td style={{textAlign:"right",fontWeight:700}}>{$(inv.total)}</td>
            <td><span className={`tag ${inv.status==="paid"?"tag-ok":inv.status==="sent"?"tag-wn":inv.status==="overdue"?"tag-er":"tag-bl"}`}>{inv.status}</span></td>
            <td><div style={{display:"flex",gap:4}}>
              <button className="btn btn-sm btn-s" onClick={()=>setSel(inv)}>View</button>
              {inv.status==="draft"&&<button className="btn btn-sm btn-ok" onClick={()=>setInvoices(p=>p.map(i=>i.id===inv.id?{...i,status:"sent"}:i))}>Send</button>}
              {inv.status==="sent"&&<button className="btn btn-sm btn-ok" onClick={()=>setInvoices(p=>p.map(i=>i.id===inv.id?{...i,status:"paid"}:i))}>Mark Paid</button>}
            </div></td>
          </tr>;})}
      </tbody></table></div>
    </div>

    {/* Invoice Detail Modal — matches CWIN printed invoice format */}
    {sel&& <div className="modal-bg" onClick={()=>setSel(null)}><div className="modal" style={{maxWidth:780,maxHeight:"92vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">
        <div style={{display:"flex",gap:8,alignItems:"center"}}>Invoice {sel.id}</div>
        <div style={{display:"flex",gap:6}}>
          <button className="btn btn-sm btn-ok" onClick={()=>{setPosted(true);setTimeout(()=>setPosted(false),3000);}}>{posted?"✓ Posted!":"📋 Post to Client Profile"}</button>
          <button className="btn btn-sm btn-p" onClick={()=>{
            const el=document.getElementById("cwin-invoice-print");if(!el)return;
            const css="body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#070707}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left;font-size:11px}th{background:#f0f0f0;font-weight:700;font-size:10px}.tw{overflow:visible}@media print{button{display:none!important}}";
            const html="<html><head><title>Invoice "+sel.id+"</title><style>"+css+"</style></head><body>"+el.innerHTML+"<br/><button onclick='window.print()' style='padding:8px 20px;background:#3c4f3d;color:#fff;border:none;cursor:pointer;font-size:14px;margin:10px'>Print / Save PDF</button></body></html>";
            let iframe=document.getElementById("cwin-pdf-frame");
            if(!iframe){iframe=document.createElement("iframe");iframe.id="cwin-pdf-frame";iframe.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;background:#fff;";document.body.appendChild(iframe);}
            else{iframe.style.display="block";}
            const doc=iframe.contentDocument||iframe.contentWindow.document;doc.open();doc.write(html);doc.close();
            const cb=doc.createElement("button");cb.textContent="Close";cb.style.cssText="position:fixed;top:10px;right:10px;padding:8px 16px;background:#070707;color:#fff;border:none;cursor:pointer;font-size:13px;z-index:100000";
            cb.onclick=function(){iframe.style.display="none";};doc.body.appendChild(cb);
          }}>📄 Download PDF</button>
          <button className="btn btn-sm btn-s" onClick={()=>setSel(null)}>✕</button>
        </div>
      </div>
      <div className="modal-b" id="cwin-invoice-print">
        {(()=>{
          const cl=clients.find(c=>c.id===sel.clientId);
          const period=billingPeriods.find(b=>b.id===sel.periodId);
          const dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
          const sortedLines=[...(sel.lines||[])].sort((a,b)=>(a.date||"").localeCompare(b.date||""));
          const rate=sortedLines[0]?.rate||rateCards.find(r=>r.clientId===sel.clientId)?.billRate||25;
          const allDays=[];
          if(period){let d=new Date(period.start+"T12:00:00");const end=new Date(period.end+"T12:00:00");while(d<=end){allDays.push({date:d.toISOString().slice(0,10),day:dayNames[d.getDay()]});d=new Date(d.getTime()+86400000);}}
          else{sortedLines.forEach(l=>{if(l.date)allDays.push({date:l.date,day:dayNames[new Date(l.date+"T12:00:00").getDay()]});});}
          const dayRows=allDays.map(d=>{const line=sortedLines.find(l=>l.date===d.date);return{...d,line,hasVisit:!!line};});
          const weeks=[];let cw=[];let wc=1;
          dayRows.forEach((d,i)=>{if(d.day==="Sunday"&&cw.length>0){weeks.push({num:wc++,days:cw});cw=[];}cw.push(d);});
          if(cw.length>0)weeks.push({num:wc,days:cw});
          const fmtHrs=(h)=>{if(!h||isNaN(h))return"";const hrs=Math.floor(h);const mins=Math.round((h-hrs)*60);return hrs+":"+String(mins).padStart(2,"0");};
          const clExp=expenses.filter(e=>e.clientId===sel.clientId&&period&&e.date>=period.start&&e.date<=period.end&&(e.status==="approved"||e.adminApproved));
          const lateFee=sel.lateFee||0;
          const prevBalance=sel.prevBalance||0;
          return <>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,paddingBottom:12,borderBottom:"2px solid #070707"}}>
              <div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:700}}>CWIN</div><div style={{fontSize:10,fontStyle:"italic",color:"var(--t2)"}}>Care When It's Needed</div><div style={{fontSize:11,color:"var(--t2)",marginTop:4}}>15941 S. Harlem Ave. #305</div><div style={{fontSize:11,color:"var(--t2)"}}>Tinley Park IL, 60477</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:700,color:"#333",letterSpacing:2}}>INVOICE</div></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14,fontSize:11}}>
              <div><div><strong>Telephone:</strong> 708.476.0021</div><div><strong>Email:</strong> CWINathome@gmail.com</div></div>
              <div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:13}}>{cl?.name}</div><div>{cl?.addr||cl?.address||""}</div></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14,padding:"8px 12px",background:"#f5f2eb",fontSize:11}}>
              <div><div><strong>Invoice #:</strong> {sel.id}</div><div><strong>Date:</strong> {fmtD(sel.date)}</div><div><strong>Client ID:</strong> {cl?.shortId||cl?.id||""}</div></div>
              <div style={{textAlign:"right"}}><div><strong>Period Beginning:</strong> {period?fmtD(period.start):""}</div><div><strong>Period Ending:</strong> {period?fmtD(period.end):""}</div></div>
            </div>
            <div className="tw" style={{marginBottom:14}}><table style={{fontSize:11}}>
              <thead><tr style={{background:"#e8e8e8"}}><th style={{width:90}}>Day</th><th style={{width:85}}>Date</th><th>Description</th><th style={{width:75}}>Sign IN</th><th style={{width:75}}>Sign OUT</th><th style={{width:55,textAlign:"center"}}>Hours</th><th style={{width:55,textAlign:"right"}}>Rate</th><th style={{width:75,textAlign:"right"}}>Total</th></tr></thead>
              <tbody>
                {weeks.map((wk,wi)=><React.Fragment key={wi}>
                  <tr><td colSpan={8} style={{background:"#e8e8e8",fontWeight:700,fontSize:10,padding:"4px 8px"}}>Week {wk.num}</td></tr>
                  {wk.days.map((d,di)=>{const l=d.line;return <tr key={di} style={{background:d.hasVisit?"#fff":"#fafafa"}}>
                    <td style={{fontWeight:600}}>{d.day}</td>
                    <td>{(d.date||"").slice(5).replace("-","/")}</td>
                    <td>{d.hasVisit?"Home Visit":""}</td>
                    <td>{d.hasVisit?(l?.signIn||l?.startTime||""):""}</td>
                    <td>{d.hasVisit?(l?.signOut||l?.endTime||""):""}</td>
                    <td style={{textAlign:"center",fontWeight:d.hasVisit?700:400}}>{d.hasVisit?fmtHrs(l?.hours):""}</td>
                    <td style={{textAlign:"right"}}>{rate.toFixed(2)}</td>
                    <td style={{textAlign:"right",fontWeight:d.hasVisit?600:400}}>{d.hasVisit?"$ "+(l?.total||0).toFixed(2):"$ -"}</td>
                  </tr>;})}
                </React.Fragment>)}
                <tr style={{background:"#f0f0f0",fontWeight:700}}><td colSpan={5} style={{textAlign:"right"}}>Total Hrs.</td><td style={{textAlign:"center"}}>{fmtHrs(sortedLines.reduce((s,l)=>s+(l.hours||0),0))}</td><td></td><td style={{textAlign:"right",fontSize:13}}>$ {(sel.subtotal||0).toFixed(2)}</td></tr>
              </tbody>
            </table></div>
            {(clExp.length>0||lateFee>0||prevBalance>0||(sel.expenses||0)>0)&&<div style={{marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:12,marginBottom:4}}>Shopping List</div>
              <div className="tw"><table style={{fontSize:11}}><thead><tr><th>Date</th><th>Description</th><th style={{textAlign:"right"}}>Amount</th></tr></thead><tbody>
                {clExp.map((e,i)=><tr key={i}><td>{fmtD(e.date)}</td><td>{e.description}</td><td style={{textAlign:"right"}}>$ {e.amount.toFixed(2)}</td></tr>)}
                {prevBalance>0&&<tr><td></td><td style={{fontStyle:"italic"}}>Previous Invoice (Not Received)</td><td style={{textAlign:"right"}}>$ {prevBalance.toFixed(2)}</td></tr>}
                {lateFee>0&&<tr><td></td><td style={{fontWeight:700}}>LATE FEE</td><td style={{textAlign:"right"}}>$ {lateFee.toFixed(2)}</td></tr>}
              </tbody></table></div>
            </div>}
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
              <div style={{border:"2px solid #070707",padding:"8px 20px",display:"flex",gap:40,alignItems:"center"}}>
                <span style={{fontWeight:700,fontSize:13}}>Total Balance</span>
                <span style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:700}}>${((sel.subtotal||0)+(sel.expenses||0)+lateFee+prevBalance).toFixed(2)}</span>
              </div>
            </div>
            <div style={{fontSize:10,color:"var(--t2)",marginBottom:14,lineHeight:1.6}}>
              <div><strong>Reminder:</strong> Please include Invoice number on check</div>
              <div><strong>QuickPay Zelle:</strong> CWINathome@gmail.com</div>
              <div><strong>Terms:</strong> Balance Due Biweekly</div>
              <div><strong>Late Fee:</strong> $30.00 if received 7 days after Invoice date.</div>
            </div>
            <div style={{border:"2px solid #070707",padding:10,fontSize:11}}>
              <div style={{fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:6,background:"#070707",color:"#fff",padding:"3px 8px",display:"inline-block"}}>REMITTANCE</div>
              <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
                {[["Name:",cl?.name||""],["Client ID:",cl?.shortId||cl?.id||""],["Invoice #:",sel.id],["Date:",fmtD(sel.date)],["Amount Due:","$"+((sel.subtotal||0)+(sel.expenses||0)+lateFee+prevBalance).toFixed(2)]].map(([k,v],i)=>
                  <tr key={i}><td style={{fontWeight:600,padding:"3px 8px",borderBottom:"1px solid #ddd",width:120}}>{k}</td><td style={{padding:"3px 8px",borderBottom:"1px solid #ddd",fontWeight:k==="Amount Due:"?700:400}}>{v}</td></tr>)}
                <tr><td style={{fontWeight:600,padding:"3px 8px",borderBottom:"1px solid #ddd"}}>Last Payment:</td><td style={{padding:"3px 8px",borderBottom:"1px solid #ddd",fontStyle:"italic",color:"var(--ok)"}}>{sel.lastPayment||""}</td></tr>
                <tr><td style={{fontWeight:600,padding:"3px 8px"}}>Amount Enclosed:</td><td style={{padding:"3px 8px",borderBottom:"1px solid #070707"}}></td></tr>
              </tbody></table>
            </div>
          </>;
        })()}
      </div>
    </div></div>}

    {/* Generate Invoice Modal */}
    {showGen&& <div className="modal-bg" onClick={()=>setShowGen(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">Generate Invoice<button className="btn btn-sm btn-s" onClick={()=>setShowGen(false)}>✕</button></div>
      <div className="modal-b">
        <div className="fg" style={{marginBottom:14}}>
          <div className="fi"><label>Client</label><select value={genClient} onChange={e=>setGenClient(e.target.value)}><option value="">Select client</option>{clients.filter(c=>c.status==="active").map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="fi"><label>Billing Period</label><select value={genPeriod} onChange={e=>setGenPeriod(e.target.value)}>{billingPeriods.map(bp=> <option key={bp.id} value={bp.id}>{bp.label}</option>)}</select></div>
        </div>
        {genClient&& <div style={{padding:12,background:"var(--bg)",marginBottom:14,fontSize:12}}>
          <div><strong>Rate:</strong> ${rateCards.find(r=>r.clientId===genClient)?.billRate||35}/hr</div>
          <div><strong>Shifts found:</strong> {(schedules||[]).filter(s=>s.clientId===genClient&&billingPeriods.find(b=>b.id===genPeriod)&&s.date>=billingPeriods.find(b=>b.id===genPeriod).start&&s.date<=billingPeriods.find(b=>b.id===genPeriod).end).length}</div>
          <div><strong>Approved expenses:</strong> {expenses.filter(e=>e.clientId===genClient&&(e.status==="approved"||e.adminApproved)&&billingPeriods.find(b=>b.id===genPeriod)&&e.date>=billingPeriods.find(b=>b.id===genPeriod).start&&e.date<=billingPeriods.find(b=>b.id===genPeriod).end).length}</div>
        </div>}
        <button className="btn btn-p" style={{width:"100%"}} onClick={()=>genClient&&generateInvoice(genClient,genPeriod)} disabled={!genClient}>Generate Invoice</button>
      </div>
    </div></div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// PAYROLL & PAY SLIPS
// ═══════════════════════════════════════════════════════════════════════
function PayrollPage({paySlips,setPaySlips,caregivers,clients,payCards,billingPeriods,schedules,expenses,rateCards}){
  const [sel,setSel]=useState(null);
  const [showGen,setShowGen]=useState(false);
  const [genCG,setGenCG]=useState("");
  const [genPeriod,setGenPeriod]=useState(billingPeriods[0]?.id||"");

  const totalPaid=paySlips.reduce((s,p)=>s+p.grossPay,0);

  const generatePaySlip=(cgId,periodId)=>{
    const period=billingPeriods.find(p=>p.id===periodId);if(!period)return;
    const cg=caregivers.find(c=>c.id===cgId);
    const pc=payCards.find(p=>p.caregiverId===cgId);
    const rate=pc?.payRate||20;
    const shifts=(schedules||[]).filter(s=>s.caregiverId===cgId&&s.date>=period.start&&s.date<=period.end&&s.status==="published");
    const lines=[];
    const clientHrs={};
    shifts.forEach(s=>{
      const cl=clients.find(c=>c.id===s.clientId);
      const hrs=(timeToMin(s.endTime)-timeToMin(s.startTime))/60;
      if(!clientHrs[s.clientId])clientHrs[s.clientId]={clientName:cl?.name||"—",hours:0};
      clientHrs[s.clientId].hours+=hrs;
    });
    Object.values(clientHrs).forEach(ch=>lines.push({...ch,rate,total:ch.hours*rate}));
    const regHours=lines.reduce((s,l)=>s+l.hours,0);
    const otHrs=Math.max(0,regHours-(pc?.otThreshold||40));
    const regH=regHours-otHrs;
    const regPay=regH*rate;
    const otPay=otHrs*(pc?.otRate||rate*1.5);
    const cgExp=expenses.filter(e=>e.caregiverId===cgId&&e.date>=period.start&&e.date<=period.end&&(e.status==="approved"||e.adminApproved));
    const expTotal=cgExp.reduce((s,e)=>s+e.amount,0);
    const mileExp=cgExp.filter(e=>e.category==="Mileage").reduce((s,e)=>s+e.amount,0);
    const ps={id:`PS-${now().getFullYear()}-${String(paySlips.length+1).padStart(3,"0")}`,caregiverId:cgId,periodId,date:today(),status:"draft",lines,regHours:regH,otHours:otHrs,regPay,otPay,expenses:expTotal-mileExp,mileage:mileExp,grossPay:regPay+otPay+expTotal,type:pc?.type||"employee"};
    setPaySlips(p=>[ps,...p]);setShowGen(false);
  };

  return <div>
    <div className="hdr"><div><h2>Payroll & Pay Slips</h2><div className="hdr-sub">Generate caregiver pay slips from completed shifts</div></div>
      <button className="btn btn-p btn-sm" onClick={()=>setShowGen(true)}>+ Generate Pay Slip</button>
    </div>

    <div className="sg">
      <div className="sc ok"><span className="sl">Total Payroll</span><span className="sv">{$(totalPaid)}</span><span className="ss">{paySlips.length} pay slips</span></div>
      <div className="sc bl"><span className="sl">Employees</span><span className="sv">{payCards.filter(p=>p.type==="employee").length}</span><span className="ss">W-2</span></div>
      <div className="sc wn"><span className="sl">Contractors</span><span className="sv">{payCards.filter(p=>p.type==="contractor").length}</span><span className="ss">1099</span></div>
      <div className="sc"><span className="sl">Draft</span><span className="sv">{paySlips.filter(p=>p.status==="draft").length}</span><span className="ss">not yet paid</span></div>
    </div>

    {/* Pay Slips Table */}
    <div className="card">
      <div className="card-h"><h3>Pay Slips</h3></div>
      <div className="tw"><table><thead><tr><th>ID</th><th>Caregiver</th><th>Type</th><th>Period</th><th>Reg Hrs</th><th>OT Hrs</th><th style={{textAlign:"right"}}>Reg Pay</th><th style={{textAlign:"right"}}>OT Pay</th><th style={{textAlign:"right"}}>Expenses</th><th style={{textAlign:"right"}}>Gross</th><th>Status</th><th></th></tr></thead><tbody>
        {paySlips.sort((a,b)=>b.date.localeCompare(a.date)).map(ps=>{const cg=caregivers.find(c=>c.id===ps.caregiverId);return <tr key={ps.id}>
          <td style={{fontFamily:"monospace",fontWeight:700}}>{ps.id}</td>
          <td style={{fontWeight:600}}>{cg?.name}</td>
          <td><span className={`tag ${ps.type==="employee"?"tag-bl":"tag-wn"}`} style={{fontSize:8}}>{ps.type==="employee"?"W-2":"1099"}</span></td>
          <td style={{fontSize:11}}>{billingPeriods.find(b=>b.id===ps.periodId)?.label||"—"}</td>
          <td>{ps.regHours.toFixed(1)}</td><td>{ps.otHours>0?ps.otHours.toFixed(1):"—"}</td>
          <td style={{textAlign:"right"}}>{$(ps.regPay)}</td>
          <td style={{textAlign:"right"}}>{ps.otPay>0?$(ps.otPay):"—"}</td>
          <td style={{textAlign:"right"}}>{ps.expenses+ps.mileage>0?$(ps.expenses+ps.mileage):"—"}</td>
          <td style={{textAlign:"right",fontWeight:700}}>{$(ps.grossPay)}</td>
          <td><span className={`tag ${ps.status==="paid"?"tag-ok":"tag-bl"}`}>{ps.status}</span></td>
          <td><div style={{display:"flex",gap:4}}>
            <button className="btn btn-sm btn-s" onClick={()=>setSel(ps)}>View</button>
            {ps.status==="draft"&&<button className="btn btn-sm btn-ok" onClick={()=>setPaySlips(p=>p.map(s=>s.id===ps.id?{...s,status:"paid"}:s))}>Mark Paid</button>}
          </div></td>
        </tr>;})}
      </tbody></table></div>
    </div>

    {/* Pay Slip Detail Modal */}
    {sel&& <div className="modal-bg" onClick={()=>setSel(null)}><div className="modal" style={{maxWidth:600}} onClick={e=>e.stopPropagation()}>
      <div className="modal-h">Pay Slip: {sel.id}<button className="btn btn-sm btn-s" onClick={()=>setSel(null)}>✕</button></div>
      <div className="modal-b">
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div><div style={{fontFamily:"var(--fd)",fontSize:18}}>{CO.name}</div><div style={{fontSize:11,color:"var(--t2)"}}>{CO.addr}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"var(--t2)"}}>Pay Slip</div><div style={{fontFamily:"monospace",fontSize:14,fontWeight:700}}>{sel.id}</div></div>
        </div>
        <div style={{padding:12,background:"var(--bg)",marginBottom:14}}>
          <div style={{fontSize:10,textTransform:"uppercase",color:"var(--t2)",fontWeight:600}}>Pay To</div>
          <div style={{fontWeight:700,fontSize:14,marginTop:2}}>{caregivers.find(c=>c.id===sel.caregiverId)?.name}</div>
          <div style={{fontSize:11,color:"var(--t2)"}}>Classification: {sel.type==="employee"?"W-2 Employee":"1099 Independent Contractor"}</div>
        </div>
        <div style={{fontSize:12,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Hours by Client</div>
        <div className="tw"><table><thead><tr><th>Client</th><th>Hours</th><th>Rate</th><th style={{textAlign:"right"}}>Amount</th></tr></thead><tbody>
          {sel.lines.map((l,i)=> <tr key={i}><td style={{fontWeight:600}}>{l.clientName}</td><td>{l.hours.toFixed(1)}</td><td>{$(l.rate)}/hr</td><td style={{textAlign:"right",fontWeight:600}}>{$(l.total)}</td></tr>)}
        </tbody></table></div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",marginTop:14,gap:4}}>
          <div style={{display:"flex",gap:30}}><span style={{fontSize:12,color:"var(--t2)"}}>Regular ({sel.regHours.toFixed(1)} hrs)</span><span style={{fontSize:12,fontWeight:600}}>{$(sel.regPay)}</span></div>
          {sel.otHours>0&&<div style={{display:"flex",gap:30}}><span style={{fontSize:12,color:"var(--t2)"}}>Overtime ({sel.otHours.toFixed(1)} hrs)</span><span style={{fontSize:12,fontWeight:600}}>{$(sel.otPay)}</span></div>}
          {sel.expenses>0&&<div style={{display:"flex",gap:30}}><span style={{fontSize:12,color:"var(--t2)"}}>Expense Reimbursement</span><span style={{fontSize:12,fontWeight:600}}>{$(sel.expenses)}</span></div>}
          {sel.mileage>0&&<div style={{display:"flex",gap:30}}><span style={{fontSize:12,color:"var(--t2)"}}>Mileage Reimbursement</span><span style={{fontSize:12,fontWeight:600}}>{$(sel.mileage)}</span></div>}
          <div style={{display:"flex",gap:30,padding:"8px 0",borderTop:"var(--border-thin)",marginTop:4}}><span style={{fontSize:14,fontWeight:700}}>Gross Pay</span><span style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400}}>{$(sel.grossPay)}</span></div>
          {sel.type==="employee"&&<div style={{fontSize:10,color:"var(--t2)",fontStyle:"italic"}}>* Tax withholdings will be applied per W-4 elections</div>}
          {sel.type==="contractor"&&<div style={{fontSize:10,color:"var(--t2)",fontStyle:"italic"}}>* No taxes withheld — 1099 contractor responsible for self-employment tax</div>}
        </div>
      </div>
    </div></div>}

    {/* Generate Pay Slip Modal */}
    {showGen&& <div className="modal-bg" onClick={()=>setShowGen(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">Generate Pay Slip<button className="btn btn-sm btn-s" onClick={()=>setShowGen(false)}>✕</button></div>
      <div className="modal-b">
        <div className="fg" style={{marginBottom:14}}>
          <div className="fi"><label>Caregiver</label><select value={genCG} onChange={e=>setGenCG(e.target.value)}><option value="">Select</option>{caregivers.filter(c=>c.status==="active").map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="fi"><label>Pay Period</label><select value={genPeriod} onChange={e=>setGenPeriod(e.target.value)}>{billingPeriods.map(bp=> <option key={bp.id} value={bp.id}>{bp.label}</option>)}</select></div>
        </div>
        {genCG&& <div style={{padding:12,background:"var(--bg)",marginBottom:14,fontSize:12}}>
          <div><strong>Pay rate:</strong> ${payCards.find(p=>p.caregiverId===genCG)?.payRate||20}/hr</div>
          <div><strong>Type:</strong> {payCards.find(p=>p.caregiverId===genCG)?.type==="contractor"?"1099 Contractor":"W-2 Employee"}</div>
          <div><strong>Shifts found:</strong> {(schedules||[]).filter(s=>s.caregiverId===genCG&&billingPeriods.find(b=>b.id===genPeriod)&&s.date>=billingPeriods.find(b=>b.id===genPeriod).start&&s.date<=billingPeriods.find(b=>b.id===genPeriod).end).length}</div>
        </div>}
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-p" style={{flex:1}} onClick={()=>genCG&&generatePaySlip(genCG,genPeriod)} disabled={!genCG}>Generate Pay Slip</button>
          <button className="btn btn-s" style={{flex:1}} onClick={()=>{caregivers.filter(c=>c.status==="active").forEach(c=>generatePaySlip(c.id,genPeriod));setShowGen(false);}}>Generate All</button>
        </div>
      </div>
    </div></div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// AI COMMAND CENTER — All 15 AI Features
// ═══════════════════════════════════════════════════════════════════════
function AIHub({clients,caregivers,careNotes,incidents,expenses,schedules,rateCards,payCards,trainingProgress,events,familyMsgs,vitals,assignments,invoices,paySlips,billingPeriods,compliance,cgApplicants,clientLeads}){
  const [tab,setTab]=useState("overview");
  const [apiLoading,setApiLoading]=useState(false);
  const [apiResult,setApiResult]=useState(null);
  const [biQuery,setBiQuery]=useState("");
  const [selClient,setSelClient]=useState(clients[0]?.id||"");
  const [selCG,setSelCG]=useState(caregivers[0]?.id||"");

  // ── CLAUDE API CALL ──
  const callAI=async(prompt,sys="You are a home care operations AI assistant for CWIN At Home LLC.")=>{
    setApiLoading(true);setApiResult(null);
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1500,system:sys,messages:[{role:"user",content:prompt}]})});
      const d=await r.json();
      const text=d.content?.map(c=>c.text||"").join("\n")||"No response";
      setApiResult(text);
    }catch(e){setApiResult("API error: "+e.message);}
    setApiLoading(false);
  };

  // ── RULE ENGINE: WELLNESS SCORES ──
  const wellnessScores=clients.filter(c=>c.status==="active").map(cl=>{
    let score=100;
    const adlDep=Object.values(cl.adl||{}).filter(v=>/(Moderate|Maximum|Total|Dependent|Bedbound|Severe)/i.test(v)).length;
    score-=adlDep*8;
    const clInc=incidents.filter(i=>i.clientId===cl.id);
    score-=clInc.filter(i=>i.status==="open").length*10;
    score-=clInc.filter(i=>i.severity==="high"||i.severity==="critical").length*5;
    if(cl.meds?.length>8)score-=5;if(cl.meds?.length>12)score-=5;
    const recentNotes=careNotes.filter(n=>n.clientId===cl.id).slice(0,5);
    const negWords=recentNotes.filter(n=>/(declined|refused|agitated|confused|fell|pain|missed|concern)/i.test(n.text)).length;
    score-=negWords*3;
    const social=cl.social?.interests?.length||0;
    if(social<3)score-=5;
    const clVitals=(vitals||[]).filter(v=>v.clientId===cl.id).slice(0,3);
    if(clVitals.some(v=>v.bp&&parseInt(v.bp)>160))score-=5;
    return{...cl,score:Math.max(5,Math.min(100,score)),adlDep,incCount:clInc.length,medCount:cl.meds?.length||0};
  }).sort((a,b)=>a.score-b.score);

  // ── RULE ENGINE: CAREGIVER SCORECARDS ──
  const scorecards=caregivers.filter(c=>c.status==="active").map(cg=>{
    const cgNotes=careNotes.filter(n=>n.caregiverId===cg.id);
    const cgInc=incidents.filter(i=>i.caregiverId===cg.id);
    const training=(trainingProgress[cg.id]||[]).length;
    const trainPct=Math.round(training/TRAINING_MODULES.length*100);
    const cgScheds=(schedules||[]).filter(s=>s.caregiverId===cg.id&&s.status==="published");
    const totalHrs=cgScheds.reduce((s,sh)=>(s+(timeToMin(sh.endTime)-timeToMin(sh.startTime))/60),0);
    let score=70;
    score+=Math.min(15,trainPct/100*15);
    score+=Math.min(10,cgNotes.length);
    score-=cgInc.length*3;
    if(totalHrs>0)score+=5;
    return{...cg,score:Math.max(10,Math.min(100,Math.round(score))),notes:cgNotes.length,incidents:cgInc.length,trainPct,hours:totalHrs};
  }).sort((a,b)=>b.score-a.score);

  // ── RULE ENGINE: TRAINING RECOMMENDER ──
  const trainingRecs=caregivers.filter(c=>c.status==="active").map(cg=>{
    const assigned=assignments?.filter(a=>a.caregiverId===cg.id&&a.status==="active").map(a=>clients.find(c=>c.id===a.clientId)).filter(Boolean)||[];
    const allDx=assigned.flatMap(c=>c.dx||[]);
    const needed=[];
    const done=(trainingProgress[cg.id]||[]);
    if(allDx.some(d=>/(Parkinson)/i.test(d))&&!done.includes(10))needed.push({mod:"Parkinson's Disease Care",idx:10,reason:"Assigned to Parkinson's patient"});
    if(allDx.some(d=>/(Alzheimer|Dementia)/i.test(d))&&!done.includes(4))needed.push({mod:"Dementia & Alzheimer's Care",idx:4,reason:"Assigned to dementia patient"});
    if(allDx.some(d=>/(CHF|Heart|Cardiac)/i.test(d))&&!done.includes(7))needed.push({mod:"Vital Signs & Health Monitoring",idx:7,reason:"Cardiac patient requires vitals monitoring"});
    if(allDx.some(d=>/(Diabetes)/i.test(d))&&!done.includes(5))needed.push({mod:"Nutrition & Meal Preparation",idx:5,reason:"Diabetic diet management needed"});
    if(assigned.some(c=>c.riskLevel==="high"||c.riskLevel==="medium")&&!done.includes(1))needed.push({mod:"Fall Prevention & Safety",idx:1,reason:"High/medium risk client"});
    if(allDx.some(d=>/(Hospice|Palliative|Terminal)/i.test(d))&&!done.includes(11))needed.push({mod:"End-of-Life & Palliative Care",idx:11,reason:"Palliative/hospice client"});
    return{cg,needed,assigned};
  });

  // ── RULE ENGINE: INCIDENT PATTERNS ──
  const incByType={};const incByClient={};const incByTime={};
  incidents.forEach(i=>{incByType[i.type]=(incByType[i.type]||0)+1;incByClient[i.clientId]=(incByClient[i.clientId]||0)+1;const h=new Date(i.date).getHours();const period=h<12?"Morning":h<17?"Afternoon":"Evening";incByTime[period]=(incByTime[period]||0)+1;});
  const topIncType=Object.entries(incByType).sort((a,b)=>b[1]-a[1])[0];
  const topIncClient=Object.entries(incByClient).sort((a,b)=>b[1]-a[1])[0];

  // ── RULE ENGINE: REVENUE FORECAST ──
  const monthScheds=(schedules||[]).filter(s=>s.status==="published");
  const projRevenue=monthScheds.reduce((s,sh)=>{const rc=rateCards?.find(r=>r.clientId===sh.clientId);const hrs=(timeToMin(sh.endTime)-timeToMin(sh.startTime))/60;return s+hrs*(rc?.billRate||35);},0);
  const projPayroll=monthScheds.reduce((s,sh)=>{const pc=payCards?.find(p=>p.caregiverId===sh.caregiverId);const hrs=(timeToMin(sh.endTime)-timeToMin(sh.startTime))/60;return s+hrs*(pc?.payRate||20);},0);
  const projMargin=projRevenue-projPayroll;

  // ── RULE ENGINE: SCHEDULE OPTIMIZER ──
  const schedConflicts=[];
  caregivers.filter(c=>c.status==="active").forEach(cg=>{
    const cgScheds=(schedules||[]).filter(s=>s.caregiverId===cg.id);
    const weekHrs=cgScheds.reduce((s,sh)=>s+(timeToMin(sh.endTime)-timeToMin(sh.startTime))/60,0);
    const pc=payCards?.find(p=>p.caregiverId===cg.id);
    if(weekHrs>(pc?.otThreshold||40))schedConflicts.push({type:"overtime",cg:cg.name,hours:weekHrs,threshold:pc?.otThreshold||40});
  });

  const tabs=[
    {key:"overview",label:"Overview"},{key:"wellness",label:"Wellness Scores"},{key:"scorecards",label:"CG Scorecards"},
    {key:"training_rec",label:"Training Recs"},{key:"incidents_ai",label:"Incident Patterns"},{key:"forecast",label:"Revenue Forecast"},
    {key:"schedule_ai",label:"Schedule AI"},{key:"care_plan",label:"Care Plan Gen"},{key:"note_writer",label:"Note Writer"},
    {key:"family_gen",label:"Family Updates"},{key:"recruit_ai",label:"Recruit Screener"},{key:"compliance_ai",label:"Compliance AI"},
    {key:"bi_chat",label:"BI Chat"},
  ];

  return <div>
    <div className="hdr"><div><h2>AI Command Center</h2><div className="hdr-sub">15 AI agents powering your operations</div></div></div>
    <div className="tab-row">{tabs.map(t=> <button key={t.key} className={`tab-btn ${tab===t.key?"act":""}`} onClick={()=>setTab(t.key)}>{t.label}</button>)}</div>

    {/* ═══ OVERVIEW ═══ */}
    {tab==="overview"&& <div>
      <div className="sg">
        <div className="sc ok"><span className="sl">Avg Wellness</span><span className="sv">{wellnessScores.length>0?Math.round(wellnessScores.reduce((s,c)=>s+c.score,0)/wellnessScores.length):0}</span><span className="ss">across {wellnessScores.length} clients</span></div>
        <div className="sc bl"><span className="sl">Avg CG Score</span><span className="sv">{scorecards.length>0?Math.round(scorecards.reduce((s,c)=>s+c.score,0)/scorecards.length):0}</span><span className="ss">{scorecards.length} caregivers</span></div>
        <div className="sc wn"><span className="sl">Training Gaps</span><span className="sv">{trainingRecs.reduce((s,r)=>s+r.needed.length,0)}</span><span className="ss">modules needed</span></div>
        <div className="sc"><span className="sl">Proj. Margin</span><span className="sv">{$(projMargin)}</span><span className="ss">{$(projRevenue)} rev</span></div>
      </div>
      <div className="ai-card"><h4><span className="pulse" style={{background:"#3c4f3d"}}/>AI operations summary</h4><p>
        {wellnessScores.filter(c=>c.score<50).length>0&&`⚠️ ${wellnessScores.filter(c=>c.score<50).map(c=>c.name).join(", ")} ${wellnessScores.filter(c=>c.score<50).length>1?"have":"has"} wellness below 50. `}
        {trainingRecs.filter(r=>r.needed.length>0).length>0&&`🎓 ${trainingRecs.filter(r=>r.needed.length>0).length} caregiver${trainingRecs.filter(r=>r.needed.length>0).length>1?"s":""} need diagnosis-specific training. `}
        {schedConflicts.length>0&&`⏰ ${schedConflicts.length} overtime risk${schedConflicts.length>1?"s":""}. `}
        {topIncType&&`Most common incident: ${topIncType[0]} (${topIncType[1]}x). `}
        Projected margin: {projRevenue>0?((projMargin/projRevenue)*100).toFixed(0):0}%.
      </p></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div className="card"><div className="card-h"><h3>Client wellness (lowest first)</h3></div>{wellnessScores.slice(0,5).map(c=> <div key={c.id} style={{padding:"10px 20px",borderBottom:"var(--border-thin)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:600,fontSize:13}}>{c.name}</div><div style={{fontSize:11,color:"var(--t2)"}}>{c.adlDep} ADL deps | {c.incCount} incidents | {c.medCount} meds</div></div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,color:c.score>=70?"#3c4f3d":c.score>=40?"#8a7356":"#7a3030"}}>{c.score}</div></div>)}</div>
        <div className="card"><div className="card-h"><h3>Caregiver performance (top)</h3></div>{scorecards.slice(0,5).map(c=> <div key={c.id} style={{padding:"10px 20px",borderBottom:"var(--border-thin)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:600,fontSize:13}}>{c.name}</div><div style={{fontSize:11,color:"var(--t2)"}}>{c.notes} notes | {c.trainPct}% trained | {c.hours.toFixed(0)}h</div></div><div style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:400,color:c.score>=80?"#3c4f3d":"#8a7356"}}>{c.score}</div></div>)}</div>
      </div>
    </div>}

    {/* ═══ WELLNESS SCORES ═══ */}
    {tab==="wellness"&& <div>
      {wellnessScores.map(c=>{const pct=c.score;return <div key={c.id} className="card card-b" style={{display:"flex",gap:16,alignItems:"center"}}>
        <div style={{width:56,height:56,display:"flex",alignItems:"center",justifyContent:"center",background:pct>=70?"var(--ok-l)":pct>=40?"var(--warn-l)":"var(--err-l)",fontSize:22,fontFamily:"var(--fd)",fontWeight:400,color:pct>=70?"#3c4f3d":pct>=40?"#8a7356":"#7a3030"}}>{pct}</div>
        <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>{c.name}</div>
          <div style={{fontSize:11,color:"var(--t2)",marginTop:2}}>{c.dx?.length||0} diagnoses | {c.medCount} meds | {c.adlDep} ADL dependencies | {c.incCount} incidents</div>
          <div className="progress-bar" style={{marginTop:6}}><div className="progress-fill" style={{width:`${pct}%`,background:pct>=70?"#3c4f3d":pct>=40?"#8a7356":"#7a3030"}}/></div>
        </div>
        <button className="btn btn-sm btn-s" onClick={()=>{setSelClient(c.id);setTab("care_plan");}}>AI care plan →</button>
      </div>;})}
    </div>}

    {/* ═══ CAREGIVER SCORECARDS ═══ */}
    {tab==="scorecards"&& <div>
      {scorecards.map(c=> <div key={c.id} className="card card-b" style={{display:"flex",gap:16,alignItems:"center"}}>
        <div style={{width:56,height:56,display:"flex",alignItems:"center",justifyContent:"center",background:c.score>=80?"var(--ok-l)":c.score>=60?"var(--warn-l)":"var(--err-l)",fontSize:22,fontFamily:"var(--fd)",fontWeight:400,color:c.score>=80?"#3c4f3d":c.score>=60?"#8a7356":"#7a3030"}}>{c.score}</div>
        <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>{c.name}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginTop:6}}>
            {[["Notes",c.notes],["Training",c.trainPct+"%"],["Incidents",c.incidents],["Hours",c.hours.toFixed(0)+"h"],["Certs",(c.certs||[]).length]].map(([l,v],i)=> <div key={i} style={{textAlign:"center",padding:4,background:"var(--bg)"}}><div style={{fontSize:8,textTransform:"uppercase",color:"var(--t2)",letterSpacing:.5}}>{l}</div><div style={{fontSize:13,fontWeight:600,marginTop:1}}>{v}</div></div>)}
          </div>
        </div>
      </div>)}
    </div>}

    {/* ═══ TRAINING RECOMMENDER ═══ */}
    {tab==="training_rec"&& <div>
      {trainingRecs.map(({cg,needed,assigned})=> <div key={cg.id} className="card" style={{marginBottom:12}}>
        <div className="card-h"><h3>{cg.name}</h3><span className={`tag ${needed.length===0?"tag-ok":"tag-wn"}`}>{needed.length===0?"Up to date":`${needed.length} needed`}</span></div>
        <div className="card-b">
          <div style={{fontSize:11,color:"var(--t2)",marginBottom:8}}>Assigned: {assigned.map(c=>c.name).join(", ")||"None"}</div>
          {needed.length===0? <div style={{fontSize:12,color:"#3c4f3d"}}>✅ All required training complete for assigned clients</div>
          : needed.map((n,i)=> <div key={i} style={{padding:"8px 12px",background:"var(--warn-l)",borderLeft:"3px solid #8a7356",marginBottom:6,fontSize:12}}>
            <div style={{fontWeight:600}}>{n.mod}</div><div style={{color:"var(--t2)",marginTop:2}}>{n.reason}</div>
          </div>)}
        </div>
      </div>)}
    </div>}

    {/* ═══ INCIDENT PATTERNS ═══ */}
    {tab==="incidents_ai"&& <div>
      <div className="sg">
        <div className="sc er"><span className="sl">Total Incidents</span><span className="sv">{incidents.length}</span></div>
        <div className="sc wn"><span className="sl">Most Common</span><span className="sv" style={{fontSize:18}}>{topIncType?topIncType[0]:"—"}</span><span className="ss">{topIncType?topIncType[1]+"x":""}</span></div>
        <div className="sc bl"><span className="sl">Peak Time</span><span className="sv" style={{fontSize:18}}>{Object.entries(incByTime).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—"}</span></div>
        <div className="sc"><span className="sl">Open</span><span className="sv">{incidents.filter(i=>i.status==="open").length}</span></div>
      </div>
      <div className="ai-card"><h4><span className="pulse" style={{background:"#7a3030"}}/>Pattern analysis</h4><p>
        {topIncType&&`${topIncType[0]} incidents are most frequent (${topIncType[1]}x). `}
        {topIncClient&&`${clients.find(c=>c.id===topIncClient[0])?.name||"Unknown"} has the most incidents (${topIncClient[1]}). `}
        {Object.entries(incByTime).sort((a,b)=>b[1]-a[1])[0]&&`Peak time: ${Object.entries(incByTime).sort((a,b)=>b[1]-a[1])[0][0]}. `}
        {incidents.filter(i=>i.type==="Fall"||i.type==="Near Fall").length>1&&"Multiple fall-related incidents detected — recommend home safety reassessment for affected clients. "}
        {incidents.filter(i=>i.type==="Medication Issue").length>0&&"Medication issues present — consider pill organizer audit and caregiver medication training review."}
      </p></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div className="card"><div className="card-h"><h3>By type</h3></div><div className="card-b">{Object.entries(incByType).sort((a,b)=>b[1]-a[1]).map(([t,c],i)=> <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"var(--border-thin)"}}><span style={{fontSize:13,fontWeight:600}}>{t}</span><span style={{fontFamily:"var(--fd)",fontSize:16}}>{c}</span></div>)}</div></div>
        <div className="card"><div className="card-h"><h3>By client</h3></div><div className="card-b">{Object.entries(incByClient).sort((a,b)=>b[1]-a[1]).map(([id,c],i)=> <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"var(--border-thin)"}}><span style={{fontSize:13,fontWeight:600}}>{clients.find(cl=>cl.id===id)?.name||id}</span><span style={{fontFamily:"var(--fd)",fontSize:16}}>{c}</span></div>)}</div></div>
      </div>
    </div>}

    {/* ═══ REVENUE FORECAST ═══ */}
    {tab==="forecast"&& <div>
      <div className="sg">
        <div className="sc ok"><span className="sl">Projected Revenue</span><span className="sv">{$(projRevenue)}</span><span className="ss">from {monthScheds.length} shifts</span></div>
        <div className="sc er"><span className="sl">Projected Payroll</span><span className="sv">{$(projPayroll)}</span></div>
        <div className="sc bl"><span className="sl">Projected Margin</span><span className="sv">{$(projMargin)}</span><span className="ss">{projRevenue>0?((projMargin/projRevenue)*100).toFixed(0):0}%</span></div>
        <div className="sc wn"><span className="sl">OT Risks</span><span className="sv">{schedConflicts.length}</span></div>
      </div>
      <div className="card"><div className="card-h"><h3>Revenue by client</h3></div><div className="tw"><table><thead><tr><th>Client</th><th>Rate</th><th>Scheduled Hrs</th><th style={{textAlign:"right"}}>Projected Rev</th><th style={{textAlign:"right"}}>Projected Cost</th><th style={{textAlign:"right"}}>Margin</th></tr></thead><tbody>
        {clients.filter(c=>c.status==="active").map(cl=>{const rc=rateCards?.find(r=>r.clientId===cl.id);const hrs=monthScheds.filter(s=>s.clientId===cl.id).reduce((s,sh)=>s+(timeToMin(sh.endTime)-timeToMin(sh.startTime))/60,0);const rev=hrs*(rc?.billRate||35);const cost=monthScheds.filter(s=>s.clientId===cl.id).reduce((s,sh)=>{const pc=payCards?.find(p=>p.caregiverId===sh.caregiverId);return s+(timeToMin(sh.endTime)-timeToMin(sh.startTime))/60*(pc?.payRate||20);},0);return <tr key={cl.id}><td style={{fontWeight:600}}>{cl.name}</td><td>${rc?.billRate||35}/hr</td><td>{hrs.toFixed(0)}h</td><td style={{textAlign:"right"}}>{$(rev)}</td><td style={{textAlign:"right"}}>{$(cost)}</td><td style={{textAlign:"right",fontWeight:700,color:"#3c4f3d"}}>{$(rev-cost)}</td></tr>;})}
      </tbody></table></div></div>
      {schedConflicts.length>0&& <div className="card" style={{marginTop:12}}><div className="card-h"><h3>Overtime risks</h3></div>{schedConflicts.map((c,i)=> <div key={i} style={{padding:"10px 20px",borderBottom:"var(--border-thin)",fontSize:12,color:"#8a7356"}}><strong>{c.cg}</strong>: {c.hours.toFixed(1)}h scheduled (threshold: {c.threshold}h) — OT cost increase applies</div>)}</div>}
    </div>}

    {/* ═══ SCHEDULE OPTIMIZER ═══ */}
    {tab==="schedule_ai"&& <div>
      <div className="ai-card"><h4><span className="pulse" style={{background:"#3c4f3d"}}/>Schedule optimization</h4><p>Analyzing {caregivers.filter(c=>c.status==="active").length} caregivers, {clients.filter(c=>c.status==="active").length} clients, {(schedules||[]).length} shifts, and {assignments?.length||0} assignments for optimal coverage.</p></div>
      <div className="card"><div className="card-h"><h3>Skill matching</h3></div><div className="card-b">
        {clients.filter(c=>c.status==="active").map(cl=>{
          const needs=cl.dx?.filter(d=>/(Parkinson|Alzheimer|Dementia|CHF|Diabetes|Wound|Hospice)/i.test(d))||[];
          const assignedCGs=assignments?.filter(a=>a.clientId===cl.id&&a.status==="active").map(a=>caregivers.find(c=>c.id===a.caregiverId)).filter(Boolean)||[];
          const certMatch=assignedCGs.filter(cg=>needs.every(n=>(cg.certs||[]).some(cert=>cert.toLowerCase().includes(n.split(" ")[0].toLowerCase().replace("'s","")))));
          return <div key={cl.id} style={{padding:"10px 0",borderBottom:"var(--border-thin)"}}>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:600}}>{cl.name}</span><span className={`tag ${certMatch.length===assignedCGs.length?"tag-ok":"tag-wn"}`}>{certMatch.length}/{assignedCGs.length} matched</span></div>
            {needs.length>0&&<div style={{fontSize:11,color:"var(--t2)",marginTop:2}}>Needs: {needs.join(", ")}</div>}
            <div style={{fontSize:11,marginTop:2}}>Assigned: {assignedCGs.map(c=>`${c.name} (${(c.certs||[]).join(", ")})`).join("; ")||"None"}</div>
          </div>;
        })}
      </div></div>
    </div>}

    {/* ═══ CLAUDE API: CARE PLAN ═══ */}
    {tab==="care_plan"&& <div>
      <div className="fg" style={{marginBottom:14}}>
        <div className="fi"><label>Select client</label><select value={selClient} onChange={e=>setSelClient(e.target.value)}>{clients.filter(c=>c.status==="active").map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      </div>
      <button className="btn btn-p" style={{marginBottom:14}} onClick={()=>{const cl=clients.find(c=>c.id===selClient);if(!cl)return;callAI(`Generate a personalized home care plan for this client:\nName: ${cl.name}, Age: ${cl.age}\nDiagnoses: ${cl.dx?.join(", ")}\nMedications: ${cl.meds?.join(", ")}\nADL Status: ${Object.entries(cl.adl||{}).map(([k,v])=>`${k}: ${v.split(" — ")[0]}`).join(", ")}\nRisk Level: ${cl.riskLevel}\nInterests: ${cl.social?.interests?.join(", ")}\n\nGenerate a care plan with: 1) Goals (measurable), 2) Interventions per goal, 3) Recommended visit frequency and hours, 4) Required caregiver skills/certifications, 5) Social engagement recommendations. Format with clear headers.`);}} disabled={apiLoading}>{apiLoading?"Generating...":"Generate AI Care Plan"}</button>
      {apiResult&& <div className="card card-b" style={{whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.8}}>{apiResult}</div>}
    </div>}

    {/* ═══ CLAUDE API: NOTE WRITER ═══ */}
    {tab==="note_writer"&& <div>
      <div className="ai-card"><h4>Shift note writer</h4><p>Select a client, then describe the visit in a few bullet points. The AI writes a professional narrative note.</p></div>
      <div className="fg" style={{marginBottom:14}}>
        <div className="fi"><label>Client</label><select value={selClient} onChange={e=>setSelClient(e.target.value)}>{clients.filter(c=>c.status==="active").map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      </div>
      <div className="fi" style={{marginBottom:14}}><label>Quick bullets (what happened)</label><textarea id="noteBullets" rows={4} placeholder="- Assisted with morning routine&#10;- Prepared breakfast, ate 80%&#10;- BP 138/82, good spirits&#10;- Light housekeeping&#10;- Reminded meds, all taken" style={{width:"100%",padding:10,border:"var(--border-thin)",fontSize:12,fontFamily:"var(--f)"}}/></div>
      <button className="btn btn-p" style={{marginBottom:14}} onClick={()=>{const cl=clients.find(c=>c.id===selClient);const bullets=document.getElementById("noteBullets")?.value;if(!bullets)return;callAI(`Write a professional home care visit note from these caregiver bullet points. Client: ${cl?.name}, Age: ${cl?.age}, Diagnoses: ${cl?.dx?.slice(0,3).join(", ")}.\n\nBullet points:\n${bullets}\n\nWrite a concise, clinical but warm narrative note (2-3 paragraphs). Include relevant observations. Do not add information not mentioned in the bullets. Use present tense for observations, past tense for completed tasks.`);}} disabled={apiLoading}>{apiLoading?"Writing...":"AI Write Note"}</button>
      {apiResult&& <div className="card card-b" style={{whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.8}}>{apiResult}</div>}
    </div>}

    {/* ═══ CLAUDE API: FAMILY UPDATES ═══ */}
    {tab==="family_gen"&& <div>
      <div className="fi" style={{marginBottom:14}}><label>Client</label><select value={selClient} onChange={e=>setSelClient(e.target.value)}>{clients.filter(c=>c.status==="active").map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <button className="btn btn-p" style={{marginBottom:14}} onClick={()=>{const cl=clients.find(c=>c.id===selClient);const notes=careNotes.filter(n=>n.clientId===selClient).slice(0,7);if(notes.length===0){setApiResult("No care notes found for this client.");return;}callAI(`Generate a warm, family-friendly weekly care update for the family of ${cl?.name} (age ${cl?.age}). Here are the recent care notes:\n\n${notes.map(n=>`[${fmtD(n.date)}] ${n.text}`).join("\n\n")}\n\nWrite a 2-3 paragraph update that:\n1) Highlights positive moments and activities\n2) Summarizes health observations in non-clinical language\n3) Notes any concerns diplomatically\n4) Ends with an encouraging note\nDo NOT include clinical jargon or internal notes.`);}} disabled={apiLoading}>{apiLoading?"Generating...":"Generate Family Update"}</button>
      {apiResult&& <div className="card card-b" style={{whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.8}}>{apiResult}</div>}
    </div>}

    {/* ═══ CLAUDE API: RECRUITING SCREENER ═══ */}
    {tab==="recruit_ai"&& <div>
      <div className="ai-card"><h4>Recruiting AI screener</h4><p>Scores applicants against your open client needs, certifications, and schedule gaps.</p></div>
      <button className="btn btn-p" style={{marginBottom:14}} onClick={()=>{const apps=(cgApplicants||[]).filter(a=>a.status!=="hired"&&a.status!=="rejected");const openNeeds=clients.filter(c=>c.status==="active").map(c=>`${c.name}: ${c.dx?.join(", ")} (${c.riskLevel} risk, $${rateCards?.find(r=>r.clientId===c.id)?.billRate||35}/hr)`);callAI(`You are a recruiting screener for a home care company. Score these applicants against our client needs.\n\nOpen client needs:\n${openNeeds.join("\n")}\n\nApplicants:\n${apps.map(a=>`${a.name}: ${a.certs?.join(", ")} | ${a.experience} | ${a.availability} | Areas: ${a.preferredAreas?.join(", ")} | Source: ${a.source}`).join("\n")}\n\nFor each applicant, provide:\n1) Match score (1-100)\n2) Best client match and why\n3) Strengths\n4) Concerns\n5) Recommended interview questions (2 specific)\n\nRank from best to worst fit.`);}} disabled={apiLoading}>{apiLoading?"Screening...":"Screen All Applicants"}</button>
      {apiResult&& <div className="card card-b" style={{whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.8}}>{apiResult}</div>}
    </div>}

    {/* ═══ CLAUDE API: COMPLIANCE ASSISTANT ═══ */}
    {tab==="compliance_ai"&& <div>
      <button className="btn btn-p" style={{marginBottom:14}} onClick={()=>{const items=(compliance||[]);callAI(`You are a compliance assistant for a home care company. Analyze these compliance items and generate a prioritized action plan.\n\nCompliance items:\n${items.map(i=>`${i.type} | ${i.entity} (${i.entityType}) | Due: ${i.dueDate} | Status: ${i.status} | Notes: ${i.notes}`).join("\n")}\n\nCaregivers: ${caregivers.map(c=>`${c.name} (${(c.certs||[]).join(", ")})`).join("; ")}\n\nProvide:\n1) Critical actions needed this week (with specific deadlines)\n2) Items due in next 30 days\n3) Risk assessment (what happens if each overdue item isn't resolved)\n4) Draft renewal reminder email for the most urgent item\n5) Recommended compliance calendar for the quarter`);}} disabled={apiLoading}>{apiLoading?"Analyzing...":"Run Compliance Analysis"}</button>
      {apiResult&& <div className="card card-b" style={{whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.8}}>{apiResult}</div>}
    </div>}

    {/* ═══ CLAUDE API: BI CHAT ═══ */}
    {tab==="bi_chat"&& <div>
      <div className="ai-card"><h4>Business intelligence chat</h4><p>Ask any question about your business data. The AI has access to all your clients, caregivers, schedules, financials, and incidents.</p></div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <input value={biQuery} onChange={e=>setBiQuery(e.target.value)} placeholder="e.g. What is my margin on Becky Sutton? Which caregiver has the most hours?" style={{flex:1,padding:"10px 14px",border:"var(--border-thin)",fontSize:13,fontFamily:"var(--f)"}} onKeyDown={e=>e.key==="Enter"&&biQuery.trim()&&callAI(`You are a business intelligence assistant for CWIN At Home LLC, a home care company. Answer this question using the data provided.\n\nQuestion: ${biQuery}\n\nData:\nClients: ${clients.filter(c=>c.status==="active").map(c=>`${c.name} (${c.id}): bill rate $${rateCards?.find(r=>r.clientId===c.id)?.billRate||35}/hr, risk: ${c.riskLevel}, dx: ${c.dx?.join(", ")}`).join("; ")}\n\nCaregivers: ${caregivers.filter(c=>c.status==="active").map(c=>`${c.name} (${c.id}): pay $${payCards?.find(p=>p.caregiverId===c.id)?.payRate||20}/hr, type: ${payCards?.find(p=>p.caregiverId===c.id)?.type||"employee"}, certs: ${(c.certs||[]).join(", ")}`).join("; ")}\n\nScheduled shifts: ${(schedules||[]).length} total, ${(schedules||[]).filter(s=>s.status==="published").length} published\n\nInvoices: ${(invoices||[]).length} total, ${$(invoices?.reduce((s,i)=>s+i.total,0)||0)} billed\nPay slips: ${(paySlips||[]).length} total, ${$(paySlips?.reduce((s,p)=>s+p.grossPay,0)||0)} paid\nExpenses: ${expenses.length} total, ${$(expenses.reduce((s,e)=>s+e.amount,0))} \nIncidents: ${incidents.length} total, ${incidents.filter(i=>i.status==="open").length} open\nCare notes: ${careNotes.length}\n\nProvide a clear, specific answer with numbers. If you need to calculate, show the math.`)}/>
        <button className="btn btn-p" onClick={()=>biQuery.trim()&&callAI(`You are a business intelligence assistant for CWIN At Home LLC. Answer: ${biQuery}\n\nClients: ${clients.filter(c=>c.status==="active").map(c=>`${c.name}: $${rateCards?.find(r=>r.clientId===c.id)?.billRate||35}/hr, ${c.dx?.length||0} dx`).join("; ")}\nCaregivers: ${caregivers.filter(c=>c.status==="active").map(c=>`${c.name}: $${payCards?.find(p=>p.caregiverId===c.id)?.payRate||20}/hr`).join("; ")}\nShifts: ${(schedules||[]).length}, Invoices: ${$(invoices?.reduce((s,i)=>s+i.total,0)||0)}, Incidents: ${incidents.length}`)} disabled={apiLoading||!biQuery.trim()}>{apiLoading?"...":"Ask"}</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {["What is my total revenue?","Which client is most profitable?","Who has the most overtime risk?","What is my average margin per hour?","Which caregiver needs the most training?"].map(q=> <button key={q} className="btn btn-sm btn-s" onClick={()=>{setBiQuery(q);}}>{q}</button>)}
      </div>
      {apiResult&& <div className="card card-b" style={{whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.8}}>{apiResult}</div>}
    </div>}
  </div>;
}
