(function(){
  "use strict";
  var KEY = "meter.v3";
  var state = { active: null, subs: [] };
  var $ = function(id){ return document.getElementById(id); };
  var el = { price:$("price"), prev:$("previous"), cur:$("current"), note:$("noteInput"), err:$("err"),
             total:$("total"), diff:$("diff"), priceView:$("priceView"), save:$("save"), copy:$("copy"),
             list:$("list"), toast:$("toast"), dlg:$("dlg"), sub:$("sub") };

  // ---------- أدوات ----------
  function round(n, d){ var f = Math.pow(10, d); return Math.round((n + Number.EPSILON) * f) / f; }
  function fmt(n){ return Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 }); }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function fmtDate(ts){
    try { return new Date(ts).toLocaleString("ar-PS-u-nu-latn", { dateStyle:"medium", timeStyle:"short" }); }
    catch(e){ return new Date(ts).toLocaleString(); }
  }
  var toastTimer;
  function toast(msg){
    el.toast.textContent = msg; el.toast.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ el.toast.classList.remove("on"); }, 2200);
  }
  // نافذة تأكيد، أو نافذة إدخال نص عند withInput
  function ask(msg, okLabel, withInput, initial){
    return new Promise(function(resolve){
      var dlg = el.dlg, input = $("dlgInput"), ok = $("dlgOk");
      $("dlgMsg").textContent = msg; ok.textContent = okLabel || "تأكيد";
      ok.className = withInput ? "primary" : "danger";
      input.hidden = !withInput; input.value = initial || "";
      dlg.returnValue = "";
      dlg.onclose = function(){
        resolve(dlg.returnValue === "ok" ? (withInput ? input.value.trim() : true) : false);
      };
      ok.onclick = function(){
        if (withInput && !input.value.trim()) { input.focus(); return; }
        dlg.close("ok");
      };
      $("dlgNo").onclick = function(){ dlg.close("no"); };
      input.onkeydown = function(e){ if (e.key === "Enter") { e.preventDefault(); ok.click(); } };
      dlg.showModal();
      if (withInput) { input.focus(); input.select(); }
    });
  }

  // ---------- التخزين والبيانات ----------
  function persist(){
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch(e){ toast("تعذّر حفظ البيانات على هذا الجهاز"); }
  }
  function newSub(name, price, records){
    var s = { id: uid(), name: name, price: price, records: records || [] };
    state.subs.push(s); state.active = s.id; return s;
  }
  function cur(){
    return state.subs.filter(function(s){ return s.id === state.active; })[0] || state.subs[0];
  }
  function load(){
    try {
      var s = localStorage.getItem(KEY);
      if (s) {
        var o = JSON.parse(s);
        if (o && Array.isArray(o.subs) && o.subs.length) { state = o; return; }
      }
      // ترحيل بيانات النسخة السابقة (مشترك واحد) إلى «المشترك 1»
      var v2 = JSON.parse(localStorage.getItem("meter.v2") || "null");
      if (v2 && Array.isArray(v2.records))
        newSub("المشترك 1", Number(v2.price) > 0 ? Number(v2.price) : 25, v2.records);
    } catch(e){}
    if (!state.subs.length) newSub("المشترك 1", 25, []);
  }

  // ---------- الحساب ----------
  function compute(){
    var pv = el.prev.value.trim(), cv = el.cur.value.trim(), price = Number(el.price.value);
    var out = { ok:false, msg:"" };
    if (!(price > 0)) { out.msg = "أدخل سعراً صحيحاً للكيلو"; return out; }
    if (pv === "" || cv === "") return out;
    var p = Number(pv), c = Number(cv);
    if (!isFinite(p) || !isFinite(c) || p < 0 || c < 0) { out.msg = "القراءات يجب أن تكون أرقاماً موجبة"; return out; }
    if (c < p) { out.msg = "القراءة الحالية أقل من السابقة، تحقق من الرقم"; return out; }
    out.ok = true; out.p = p; out.c = c; out.price = price;
    out.diff = round(c - p, 3); out.total = round(out.diff * price, 2);
    return out;
  }
  function update(){
    var r = compute();
    el.err.textContent = r.msg;
    el.priceView.textContent = Number(el.price.value) > 0 ? fmt(el.price.value) + " ش" : "—";
    el.diff.textContent = r.ok ? fmt(r.diff) : "—";
    el.total.textContent = r.ok ? fmt(r.total) : "—";
    el.save.disabled = el.copy.disabled = !r.ok;
    return r;
  }
  function sumOf(recs, key){
    return recs.reduce(function(a, r){ return a + (Number(r[key]) || 0); }, 0);
  }

  // ---------- العرض ----------
  function renderSubs(){
    var s = cur(), grand = 0;
    el.sub.textContent = "";
    state.subs.forEach(function(x){
      var o = document.createElement("option"); o.value = x.id; o.textContent = x.name;
      o.selected = x.id === s.id; el.sub.appendChild(o);
    });
    var box = $("allSubs"); box.textContent = "";
    state.subs.forEach(function(x){
      var total = round(sumOf(x.records, "total"), 2); grand += total;
      var b = document.createElement("button"); b.className = "sub-row";
      b.setAttribute("aria-current", x.id === s.id ? "true" : "false");
      var left = document.createElement("span"); left.textContent = x.name;
      var small = document.createElement("small");
      small.textContent = x.records.length + " سجل · آخر قراءة " + (x.records.length ? fmt(x.records[0].current) : "—");
      left.appendChild(small);
      var amt = document.createElement("b"); amt.textContent = fmt(total) + " ش";
      b.append(left, amt);
      b.onclick = function(){ state.active = x.id; persist(); showSub(); };
      box.appendChild(b);
    });
    $("grand").textContent = fmt(round(grand, 2)) + " ش";
    $("histTitle").textContent = "سجل: " + s.name;
  }
  function render(){
    var recs = cur().records;
    $("sCount").textContent = recs.length;
    $("sKwh").textContent = fmt(round(sumOf(recs, "difference"), 3));
    $("sSum").textContent = fmt(round(sumOf(recs, "total"), 2));
    $("clear").style.display = recs.length ? "" : "none";
    el.list.textContent = "";
    if (!recs.length) {
      var e = document.createElement("div"); e.className = "empty";
      e.textContent = "لا توجد سجلات لهذا المشترك. أدخل القراءة الحالية ثم اضغط «حفظ القراءة».";
      el.list.appendChild(e); return;
    }
    recs.forEach(function(r){
      var d = document.createElement("div"); d.className = "rec";
      var top = document.createElement("div"); top.className = "rec-top";
      var dt = document.createElement("span"); dt.textContent = r.label || fmtDate(r.ts);
      var del = document.createElement("button"); del.className = "x"; del.textContent = "حذف";
      del.setAttribute("aria-label", "حذف هذا السجل");
      del.onclick = function(){ removeRecord(r.id); };
      top.append(dt, del); d.appendChild(top);
      if (r.note) { var n = document.createElement("div"); n.className = "rec-note"; n.textContent = r.note; d.appendChild(n); }
      var body = document.createElement("div"); body.className = "rec-body";
      var l = document.createElement("div"); l.className = "r";
      l.textContent = fmt(r.previous) + " ← " + fmt(r.current) + "  |  " + fmt(r.difference) + " كيلو × " + fmt(r.price || 25);
      var t = document.createElement("div"); t.className = "t"; t.textContent = fmt(r.total) + " ش";
      body.append(l, t); d.appendChild(body); el.list.appendChild(d);
    });
  }
  // تحميل بيانات المشترك الحالي في الحقول
  function showSub(){
    var s = cur(); state.active = s.id;
    el.price.value = s.price;
    el.prev.value = s.records.length ? s.records[0].current : 0;
    el.cur.value = ""; el.note.value = "";
    renderSubs(); update(); render();
  }

  // ---------- عمليات القراءات ----------
  function saveRecord(){
    var r = update(); if (!r.ok) return;
    var s = cur();
    s.records.unshift({ id: uid(), previous: r.p, current: r.c, difference: r.diff, price: r.price,
                        total: r.total, note: el.note.value.trim(), ts: Date.now() });
    s.price = r.price; persist();
    el.prev.value = r.c; el.cur.value = ""; el.note.value = "";
    update(); render(); renderSubs(); toast("تم حفظ القراءة"); el.cur.focus();
  }
  function removeRecord(id){
    ask("هل تريد حذف هذا السجل؟", "حذف").then(function(ok){
      if (!ok) return;
      var s = cur();
      s.records = s.records.filter(function(r){ return r.id !== id; });
      persist(); showSub(); toast("تم حذف السجل");
    });
  }
  function clearRecords(){
    var s = cur();
    ask("سيتم حذف جميع سجلات «" + s.name + "» نهائياً. هل أنت متأكد؟", "حذف السجلات").then(function(ok){
      if (!ok) return;
      s.records = []; persist(); showSub(); toast("تم حذف السجلات");
    });
  }
  function copySummary(){
    var r = update(); if (!r.ok) return;
    var text = "المشترك: " + cur().name + "\nالقراءة السابقة: " + fmt(r.p) + "\nالقراءة الحالية: " + fmt(r.c) +
               "\nالاستهلاك: " + fmt(r.diff) + " كيلو\nسعر الكيلو: " + fmt(r.price) +
               " شيكل\nالمبلغ المطلوب: " + fmt(r.total) + " شيكل";
    var fallback = function(){
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch(e){}
      document.body.removeChild(ta); toast(ok ? "تم نسخ الملخص" : "تعذّر النسخ");
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(function(){ toast("تم نسخ الملخص"); }, fallback);
    else fallback();
  }

  // ---------- عمليات المشتركين ----------
  function addSub(){
    ask("اسم المشترك الجديد", "إضافة", true, "").then(function(name){
      if (!name) return;
      newSub(name, cur().price, []); persist(); showSub(); toast("تمت إضافة المشترك");
      el.cur.focus();
    });
  }
  function renameSub(){
    var s = cur();
    ask("اسم المشترك", "حفظ", true, s.name).then(function(name){
      if (!name) return;
      s.name = name; persist(); renderSubs(); toast("تم تعديل الاسم");
    });
  }
  function deleteSub(){
    var s = cur();
    if (state.subs.length < 2) { toast("لا يمكن حذف المشترك الوحيد، يمكنك حذف سجلاته فقط"); return; }
    ask("حذف المشترك «" + s.name + "» وجميع سجلاته (" + s.records.length + ")؟", "حذف المشترك").then(function(ok){
      if (!ok) return;
      state.subs = state.subs.filter(function(x){ return x.id !== s.id; });
      state.active = state.subs[0].id; persist(); showSub(); toast("تم حذف المشترك");
    });
  }

  // ---------- النسخ الاحتياطي ----------
  function exportData(){
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "meter-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    toast("تم تنزيل النسخة الاحتياطية");
  }
  function importData(file){
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function(){
      var o;
      try {
        o = JSON.parse(fr.result);
        if (!o || !Array.isArray(o.subs) || !o.subs.length) throw 0;
        o.subs.forEach(function(s){
          if (!s.id || !s.name || !Array.isArray(s.records)) throw 0;
          s.price = Number(s.price) > 0 ? Number(s.price) : 25;
        });
      } catch(e){ toast("الملف غير صالح"); return; }
      ask("سيتم استبدال البيانات الحالية بالنسخة الاحتياطية (" + o.subs.length + " مشترك). متابعة؟", "استعادة").then(function(ok){
        if (!ok) return;
        state = o;
        if (!cur() || cur().id !== state.active) state.active = state.subs[0].id;
        persist(); showSub(); toast("تمت استعادة البيانات");
      });
    };
    fr.readAsText(file);
  }

  // ---------- الربط ----------
  load();
  [el.prev, el.cur, el.price].forEach(function(i){ i.addEventListener("input", update); });
  el.price.addEventListener("change", function(){
    var p = Number(el.price.value);
    if (p > 0) { cur().price = p; persist(); }
  });
  el.cur.addEventListener("keydown", function(e){ if (e.key === "Enter") saveRecord(); });
  el.sub.addEventListener("change", function(){ state.active = el.sub.value; persist(); showSub(); });
  el.save.onclick = saveRecord; el.copy.onclick = copySummary; $("clear").onclick = clearRecords;
  $("addSub").onclick = addSub; $("renSub").onclick = renameSub; $("delSub").onclick = deleteSub;
  $("export").onclick = exportData;
  $("import").onclick = function(){ $("file").click(); };
  $("file").addEventListener("change", function(e){ importData(e.target.files[0]); e.target.value = ""; });
  showSub();
})();
