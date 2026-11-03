(function(){
  var KEY = "meter.v2";
  var state = { price: 25, records: [] };
  var $ = function(id){ return document.getElementById(id); };
  var el = { price:$("price"), prev:$("previous"), cur:$("current"), note:$("noteInput"), err:$("err"),
             total:$("total"), diff:$("diff"), priceView:$("priceView"), save:$("save"), copy:$("copy"),
             list:$("list"), toast:$("toast"), dlg:$("dlg") };

  // ---------- أدوات ----------
  function round(n, d){ var f = Math.pow(10, d); return Math.round((n + Number.EPSILON) * f) / f; }
  function fmt(n){ return Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 }); }
  function fmtDate(ts){
    try { return new Date(ts).toLocaleString("ar-PS-u-nu-latn", { dateStyle:"medium", timeStyle:"short" }); }
    catch(e){ return new Date(ts).toLocaleString(); }
  }
  var toastTimer;
  function toast(msg){
    el.toast.textContent = msg; el.toast.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ el.toast.classList.remove("on"); }, 2200);
  }
  function ask(msg, okLabel){
    return new Promise(function(resolve){
      $("dlgMsg").textContent = msg; $("dlgOk").textContent = okLabel || "تأكيد";
      var done = function(v){ el.dlg.close(); $("dlgOk").onclick = $("dlgNo").onclick = null; resolve(v); };
      $("dlgOk").onclick = function(){ done(true); };
      $("dlgNo").onclick = function(){ done(false); };
      el.dlg.addEventListener("cancel", function once(){ el.dlg.removeEventListener("cancel", once); resolve(false); });
      el.dlg.showModal();
    });
  }

  // ---------- التخزين ----------
  function persist(){
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch(e){ toast("تعذّر حفظ البيانات على هذا الجهاز"); }
  }
  function load(){
    try {
      var s = localStorage.getItem(KEY);
      if (s) {
        var o = JSON.parse(s);
        if (o && Array.isArray(o.records)) {
          state.records = o.records;
          if (Number(o.price) > 0) state.price = Number(o.price);
          return;
        }
      }
      // ترحيل بيانات النسخة القديمة
      var old = JSON.parse(localStorage.getItem("history") || "null");
      if (Array.isArray(old)) {
        state.records = old.map(function(r, i){
          return { id: Date.now() + i, previous: r.previous, current: r.current, difference: r.difference,
                   price: 25, total: r.total, note: "", ts: Date.now() - i, label: r.date };
        });
      }
    } catch(e){}
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

  // ---------- العرض ----------
  function render(){
    var recs = state.records, kwh = 0, sum = 0;
    recs.forEach(function(r){ kwh += Number(r.difference) || 0; sum += Number(r.total) || 0; });
    $("sCount").textContent = recs.length;
    $("sKwh").textContent = fmt(round(kwh, 3));
    $("sSum").textContent = fmt(round(sum, 2));
    $("clear").style.display = recs.length ? "" : "none";
    el.list.textContent = "";
    if (!recs.length) {
      var e = document.createElement("div"); e.className = "empty";
      e.textContent = "لا توجد سجلات بعد. أدخل القراءة الحالية ثم اضغط «حفظ القراءة».";
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

  // ---------- العمليات ----------
  function saveRecord(){
    var r = update(); if (!r.ok) return;
    state.records.unshift({ id: Date.now(), previous: r.p, current: r.c, difference: r.diff, price: r.price,
                            total: r.total, note: el.note.value.trim(), ts: Date.now() });
    state.price = r.price; persist();
    el.prev.value = r.c; el.cur.value = ""; el.note.value = "";
    update(); render(); toast("تم حفظ القراءة"); el.cur.focus();
  }
  function removeRecord(id){
    ask("هل تريد حذف هذا السجل؟", "حذف").then(function(ok){
      if (!ok) return;
      state.records = state.records.filter(function(r){ return r.id !== id; });
      persist(); el.prev.value = state.records.length ? state.records[0].current : 0;
      update(); render(); toast("تم حذف السجل");
    });
  }
  function clearAll(){
    ask("سيتم حذف جميع القراءات والسجلات نهائياً. هل أنت متأكد؟", "حذف الكل").then(function(ok){
      if (!ok) return;
      state.records = []; persist(); el.prev.value = 0; el.cur.value = "";
      update(); render(); toast("تم حذف جميع البيانات");
    });
  }
  function copySummary(){
    var r = update(); if (!r.ok) return;
    var text = "القراءة السابقة: " + fmt(r.p) + "\nالقراءة الحالية: " + fmt(r.c) +
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

  // ---------- الربط ----------
  load();
  el.price.value = state.price;
  el.prev.value = state.records.length ? state.records[0].current : 0;
  [el.prev, el.cur, el.price].forEach(function(i){ i.addEventListener("input", update); });
  el.price.addEventListener("change", function(){
    var p = Number(el.price.value);
    if (p > 0) { state.price = p; persist(); }
  });
  el.cur.addEventListener("keydown", function(e){ if (e.key === "Enter") saveRecord(); });
  el.save.onclick = saveRecord; el.copy.onclick = copySummary; $("clear").onclick = clearAll;
  update(); render();
})();