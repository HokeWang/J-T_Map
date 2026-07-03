const state = {
  headers: [],
  rows: [],
  map: null,
  maps: new Map(),
  markers: [],
  lines: [],
  schemes: createDefaultSchemes(),
  providers: createDefaultProviders()
};

const refs = {
  apiKey: document.querySelector("#apiKey"),
  countryCode: document.querySelector("#countryCode"),
  loadMapButton: document.querySelector("#loadMapButton"),
  mapStatus: document.querySelector("#mapStatus"),
  fileInput: document.querySelector("#fileInput"),
  templateButton: document.querySelector("#templateButton"),
  sampleButton: document.querySelector("#sampleButton"),
  fileSummary: document.querySelector("#fileSummary"),
  schemeList: document.querySelector("#schemeList"),
  addSchemeButton: document.querySelector("#addSchemeButton"),
  rowLimit: document.querySelector("#rowLimit"),
  thresholdMeters: document.querySelector("#thresholdMeters"),
  priorityOrder: document.querySelector("#priorityOrder"),
  providerSummary: document.querySelector("#providerSummary"),
  providerButton: document.querySelector("#providerButton"),
  runButton: document.querySelector("#runButton"),
  resultsHead: document.querySelector("#resultsHead"),
  resultsBody: document.querySelector("#resultsBody"),
  providerModal: document.querySelector("#providerModal"),
  providerList: document.querySelector("#providerList"),
  addProviderButton: document.querySelector("#addProviderButton"),
  saveProvidersButton: document.querySelector("#saveProvidersButton"),
  closeProvidersButton: document.querySelector("#closeProvidersButton"),
  mapContainer: document.querySelector("#map")
};

const defaultAddressFields = ["省", "province", "州", "state", "市", "city", "区", "district", "邮编", "postalCode", "postal_code", "zip", "详细地址", "address", "street", "street_address"];
const palette = ["#2f6fed", "#e7832a", "#8b5cf6", "#0f9f8f", "#d946ef", "#64748b"];

refs.loadMapButton.addEventListener("click", loadGoogleMaps);
refs.apiKey.addEventListener("input", updateRunState);
refs.countryCode.addEventListener("input", () => {
  refs.countryCode.value = refs.countryCode.value.toUpperCase();
});
refs.fileInput.addEventListener("change", handleFileUpload);
refs.templateButton.addEventListener("click", downloadExcelTemplate);
refs.sampleButton.addEventListener("click", loadSampleData);
refs.addSchemeButton.addEventListener("click", addScheme);
refs.providerButton.addEventListener("click", openProviderModal);
refs.closeProvidersButton.addEventListener("click", closeProviderModal);
refs.addProviderButton.addEventListener("click", () => addProviderEditor());
refs.saveProvidersButton.addEventListener("click", saveProvidersFromModal);
refs.runButton.addEventListener("click", runComparison);
refs.resultsBody.addEventListener("click", handleResultLocate);
refs.thresholdMeters.addEventListener("input", updateRunState);
refs.priorityOrder.addEventListener("input", updateProviderSummary);

function createDefaultSchemes() {
  return [
    { id: makeId(), name: "完整地址", fields: [] }
  ];
}

function createDefaultProviders() {
  return [
    {
      id: makeId(),
      name: "Google",
      enabled: true,
      method: "GET",
      url: "https://maps.googleapis.com/maps/api/geocode/json",
      params: [
        { key: "key", value: "{{googleKey}}" },
        { key: "address", value: "{{address}}" },
        { key: "country", value: "{{country}}" }
      ],
      bodyParams: [],
      latPath: "results.0.geometry.location.lat",
      lngPath: "results.0.geometry.location.lng",
      labelPath: "results.0.formatted_address"
    },
    {
      id: makeId(),
      name: "Microsoft",
      enabled: false,
      method: "GET",
      url: "https://atlas.microsoft.com/search/address/json",
      params: [
        { key: "subscription-key", value: "" },
        { key: "api-version", value: "1.0" },
        { key: "language", value: "{{country}}" },
        { key: "query", value: "{{address}}" },
        { key: "countrySet", value: "{{country}}" }
      ],
      bodyParams: [],
      latPath: "results.0.position.lat",
      lngPath: "results.0.position.lon",
      labelPath: "results.0.address.freeformAddress"
    },
    {
      id: makeId(),
      name: "Amazon",
      enabled: false,
      method: "POST",
      url: "https://places.geo.eu-central-1.amazonaws.com/v2/geocode",
      params: [
        { key: "key", value: "" }
      ],
      bodyParams: [
        { key: "QueryText", value: "{{address}}" },
        { key: "Language", value: "{{country}}" }
      ],
      latPath: "ResultItems.0.Position.1",
      lngPath: "ResultItems.0.Position.0",
      labelPath: "ResultItems.0.Title"
    },
    {
      id: makeId(),
      name: "Addressy",
      enabled: false,
      method: "POST",
      url: "https://api.addressy.com/Cleansing/International/Batch/v1.20/json6.ws",
      params: [
        { key: "Key", value: "" }
      ],
      bodyParams: [
        { key: "Key", value: "" },
        { key: "GeoCode", value: "true" },
        { key: "Addresses.0.Id", value: "{{id}}" },
        { key: "Addresses.0.Address", value: "{{Address}}" },
        { key: "Addresses.0.PostalCode", value: "{{PostalCode}}" },
        { key: "Addresses.0.Country", value: "{{Country}}" },
        { key: "Addresses.0.AdministrativeArea", value: "{{AdministrativeArea}}" },
        { key: "Addresses.0.Locality", value: "{{Locality}}" },
        { key: "Addresses.0.SubAdministrativeArea", value: "{{SubAdministrativeArea}}" },
        { key: "Options.Process", value: "Verify" },
        { key: "Options.ServerOptions.OutputScript", value: "Latn" },
        { key: "Options.ServerOptions.OutputCasing", value: "Title" },
        { key: "Options.ServerOptions.ReturnVerifiedFieldsOnly", value: "No" }
      ],
      latPath: "0.Matches.0.Latitude",
      lngPath: "0.Matches.0.Longitude",
      labelPath: "0.Matches.0.Address"
    }
  ];
}

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function setStatus(message, isError = false) {
  refs.mapStatus.textContent = message;
  refs.mapStatus.classList.toggle("error-text", isError);
}

function loadGoogleMaps() {
  const key = refs.apiKey.value.trim();
  if (!key) {
    setStatus("请先输入 Google Maps JavaScript API Key。", true);
    return;
  }

  if (window.google?.maps?.Map) {
    initializeMap();
    return;
  }

  setStatus("正在加载 Google 地图...");
  window.__initAddressComparisonMap = () => initializeMap();

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__initAddressComparisonMap&language=zh-CN`;
  script.async = true;
  script.defer = true;
  script.onerror = () => setStatus("地图脚本加载失败，请检查 API Key、网络和 API 启用状态。", true);
  document.head.appendChild(script);
}

function initializeMap() {
  createSchemeMaps();
  setStatus("地图已加载，可以开始多供应商解析。请求会通过本地服务代理执行。");
  updateRunState();
}

function createSchemeMaps() {
  state.maps.clear();
  state.map = null;
  refs.mapContainer.innerHTML = "";
  const schemes = getVisibleSchemesForMaps();

  schemes.forEach((scheme, index) => {
    const card = document.createElement("section");
    card.className = "scheme-map-card";
    card.innerHTML = `<div class="scheme-map-title">${escapeHtml(scheme.name)}</div><div class="map-canvas"></div>`;
    refs.mapContainer.append(card);

    const mapElement = card.querySelector(".map-canvas");
    const map = new google.maps.Map(mapElement, {
      center: { lat: 31.2304, lng: 121.4737 },
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });
    state.maps.set(scheme.id, map);
    if (index === 0) {
      state.map = map;
    }
  });
}

function getVisibleSchemesForMaps() {
  const enabled = getEnabledSchemes();
  return (enabled.length ? enabled : state.schemes).slice(0, 3);
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  loadAddressText(text, file.name);
}

async function loadSampleData() {
  const response = await fetch("sample-addresses.csv");
  const text = await response.text();
  loadAddressText(text, "sample-addresses.csv");
}

function loadAddressText(text, name) {
  const parsed = looksLikeExcelHtml(text) ? parseExcelHtml(text) : parseCsv(text);
  state.headers = parsed.headers;
  state.rows = parsed.rows;
  refs.fileSummary.textContent = `${name}: ${state.rows.length} 行地址，${state.headers.length} 个字段。`;
  initializeSchemeFields();
  renderSchemes();
  refreshSchemeMapsIfLoaded();
  updateRunState();
}

function downloadExcelTemplate() {
  const headers = ["省", "市", "区", "邮编", "详细地址", "国家"];
  const rows = [
    ["BOGOTA D.C.", "BOGOTA", "LOCALIDAD SUBA", "111121", "Calle 95 #71-75", "CO"],
    ["", "", "", "", "", ""]
  ];
  const tableRows = [headers, ...rows]
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const workbook = `<!doctype html><html><head><meta charset="utf-8"></head><body><table>${tableRows}</table></body></html>`;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "address-geocoding-import-template.xls";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function looksLikeExcelHtml(text) {
  return /<table[\s>]/i.test(text) && /<tr[\s>]/i.test(text);
}

function parseExcelHtml(text) {
  const documentFragment = new DOMParser().parseFromString(text, "text/html");
  const tableRows = Array.from(documentFragment.querySelectorAll("tr"))
    .map((row) => Array.from(row.querySelectorAll("th,td")).map((cell) => cell.textContent.trim()))
    .filter((row) => row.some(Boolean));

  const headers = tableRows.shift() || [];
  return {
    headers,
    rows: tableRows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])))
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return {
    headers,
    rows: rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])))
  };
}

function initializeSchemeFields() {
  const defaults = state.headers.filter((header) => defaultAddressFields.map(normalizeHeader).includes(normalizeHeader(header)));
  const detailFirst = [...defaults].sort((a, b) => Number(isDetailField(b)) - Number(isDetailField(a)));
  state.schemes.forEach((scheme, index) => {
    scheme.fields = index === 1 ? detailFirst : defaults;
  });
}

function isDetailField(header) {
  return ["详细地址", "address", "street", "street_address"].map(normalizeHeader).includes(normalizeHeader(header));
}

function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function renderSchemes() {
  refs.addSchemeButton.disabled = state.schemes.length >= 3;
  refs.schemeList.classList.remove("empty-list");
  refs.schemeList.innerHTML = "";

  state.schemes.forEach((scheme) => {
    const card = document.createElement("section");
    card.className = "scheme-card";
    card.dataset.schemeId = scheme.id;
    card.innerHTML = `
      <div class="scheme-card-head">
        <input class="scheme-name" type="text" value="${escapeAttribute(scheme.name)}" aria-label="方案名称">
        <button type="button" class="secondary-button remove-scheme" ${state.schemes.length <= 1 ? "disabled" : ""}>删除</button>
      </div>
      <div class="field-list"></div>
      <div class="address-preview">预览为空</div>
    `;

    const fieldList = card.querySelector(".field-list");
    if (!state.headers.length) {
      fieldList.classList.add("empty-list");
      fieldList.textContent = "导入数据后显示字段。";
    }

    state.headers.forEach((header) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = header;
      checkbox.checked = scheme.fields.includes(header);
      checkbox.addEventListener("change", () => syncSchemeFromCard(card));
      label.append(checkbox, document.createTextNode(header));
      fieldList.append(label);
    });

    card.querySelector(".scheme-name").addEventListener("input", () => syncSchemeFromCard(card));
    card.querySelector(".remove-scheme").addEventListener("click", () => removeScheme(scheme.id));
    refs.schemeList.append(card);
    updateSchemePreview(card, state.rows[0]);
  });
}

function syncSchemeFromCard(card) {
  const scheme = state.schemes.find((item) => item.id === card.dataset.schemeId);
  if (!scheme) {
    return;
  }
  scheme.name = card.querySelector(".scheme-name").value.trim() || "未命名方案";
  scheme.fields = Array.from(card.querySelectorAll('.field-list input[type="checkbox"]:checked')).map((input) => input.value);
  updateSchemePreview(card, state.rows[0]);
  refreshSchemeMapsIfLoaded();
  updateRunState();
}

function updateSchemePreview(card, row) {
  const scheme = state.schemes.find((item) => item.id === card.dataset.schemeId);
  card.querySelector(".address-preview").textContent = row && scheme ? composeAddress(row, scheme.fields) || "预览为空" : "预览为空";
}

function addScheme() {
  if (state.schemes.length >= 3) {
    setStatus("最多只能配置 3 个地址入参方案。", true);
    return;
  }
  const defaults = state.headers.filter((header) => defaultAddressFields.map(normalizeHeader).includes(normalizeHeader(header)));
  state.schemes.push({ id: makeId(), name: `方案${state.schemes.length + 1}`, fields: defaults });
  renderSchemes();
  refreshSchemeMapsIfLoaded();
  updateRunState();
}

function removeScheme(id) {
  state.schemes = state.schemes.filter((scheme) => scheme.id !== id);
  renderSchemes();
  refreshSchemeMapsIfLoaded();
  updateRunState();
}

function refreshSchemeMapsIfLoaded() {
  if (!window.google?.maps?.Map || !state.maps.size) {
    return;
  }
  clearMap();
  createSchemeMaps();
}

function getEnabledSchemes() {
  return state.schemes.filter((scheme) => scheme.fields.length).slice(0, 3);
}

function composeAddress(row, fields) {
  return fields.map((field) => row[field]).filter(Boolean).join(", ");
}

function getEnabledProviders() {
  return state.providers.filter((provider) => provider.enabled && provider.url.trim());
}

function getPriorityNames() {
  return refs.priorityOrder.value.split(">").map((name) => name.trim()).filter(Boolean);
}

function updateProviderSummary() {
  const enabled = getEnabledProviders();
  refs.providerSummary.textContent = enabled.length ? `已启用: ${enabled.map((provider) => provider.name).join("、")}；阈值 ${refs.thresholdMeters.value || 100} 米；优先级 ${refs.priorityOrder.value || "未配置"}` : "尚未启用可请求的供应商。";
}

function updateRunState() {
  updateProviderSummary();
  refs.runButton.disabled = !state.map || !state.rows.length || !refs.apiKey.value.trim() || !getEnabledSchemes().length || !getEnabledProviders().length;
}

function openProviderModal() {
  renderProviderEditors();
  refs.providerModal.hidden = false;
}

function closeProviderModal() {
  refs.providerModal.hidden = true;
}

function renderProviderEditors() {
  refs.providerList.innerHTML = "";
  state.providers.forEach((provider, index) => addProviderEditor(provider, index));
}

function addProviderEditor(provider = null, index = state.providers.length) {
  const current = provider || {
    id: makeId(),
    name: `供应商${index + 1}`,
    enabled: true,
    method: "GET",
    url: "",
    params: [{ key: "address", value: "{{address}}" }, { key: "key", value: "" }],
    bodyParams: [],
    latPath: "",
    lngPath: "",
    labelPath: ""
  };
  const card = document.createElement("section");
  card.className = "provider-card";
  card.dataset.providerId = current.id;
  card.innerHTML = `
    <div class="provider-card-head">
      <label><input class="provider-enabled" type="checkbox" ${current.enabled ? "checked" : ""}> 启用</label>
      <input class="provider-name" type="text" value="${escapeAttribute(current.name)}" placeholder="供应商名称，例如 Google">
    </div>
    <label>请求方法</label>
    <select class="provider-method">
      <option value="GET" ${current.method !== "POST" ? "selected" : ""}>GET</option>
      <option value="POST" ${current.method === "POST" ? "selected" : ""}>POST</option>
    </select>
    <label>请求 URL</label>
    <input class="provider-url" type="text" value="${escapeAttribute(current.url)}" placeholder="https://example.com/geocode">
    <div class="path-grid">
      <label>纬度 JSON 路径<input class="provider-lat" type="text" value="${escapeAttribute(current.latPath)}" placeholder="results.0.geometry.location.lat"></label>
      <label>经度 JSON 路径<input class="provider-lng" type="text" value="${escapeAttribute(current.lngPath)}" placeholder="results.0.geometry.location.lng"></label>
      <label>地址标签路径<input class="provider-label" type="text" value="${escapeAttribute(current.labelPath)}" placeholder="results.0.formatted_address"></label>
    </div>
    <div class="param-table query-param-table">
      <div class="param-row param-title"><span>Query Key</span><span>Value</span></div>
      ${renderParamRows(current.params)}
    </div>
    <div class="param-table body-param-table">
      <div class="param-row param-title"><span>Body Key</span><span>Value</span></div>
      ${renderBodyParamRows(current.bodyParams || [])}
    </div>
  `;
  refs.providerList.append(card);
}

function renderParamRows(params) {
  const rows = [...params];
  while (rows.length < 5) {
    rows.push({ key: "", value: "" });
  }
  return rows.map((param) => `
    <div class="param-row">
      <input class="param-key" type="text" value="${escapeAttribute(param.key)}" placeholder="key">
      <input class="param-value" type="text" value="${escapeAttribute(param.value)}" placeholder="{{address}} / {{country}} / {{googleKey}} / 固定值">
    </div>
  `).join("");
}

function renderBodyParamRows(params) {
  return renderParamRows(params);
}

function saveProvidersFromModal() {
  state.providers = Array.from(refs.providerList.querySelectorAll(".provider-card")).map((card) => ({
    id: card.dataset.providerId || makeId(),
    enabled: card.querySelector(".provider-enabled").checked,
    name: card.querySelector(".provider-name").value.trim() || "未命名供应商",
    method: card.querySelector(".provider-method").value,
    url: card.querySelector(".provider-url").value.trim(),
    latPath: card.querySelector(".provider-lat").value.trim(),
    lngPath: card.querySelector(".provider-lng").value.trim(),
    labelPath: card.querySelector(".provider-label").value.trim(),
    params: Array.from(card.querySelectorAll(".query-param-table .param-row:not(.param-title)")).map((row) => ({
      key: row.querySelector(".param-key").value.trim(),
      value: row.querySelector(".param-value").value.trim()
    })).filter((param) => param.key),
    bodyParams: Array.from(card.querySelectorAll(".body-param-table .param-row:not(.param-title)")).map((row) => ({
      key: row.querySelector(".param-key").value.trim(),
      value: row.querySelector(".param-value").value.trim()
    })).filter((param) => param.key)
  }));
  if (!refs.priorityOrder.value.trim()) {
    refs.priorityOrder.value = state.providers.map((provider) => provider.name).join(">");
  }
  closeProviderModal();
  updateRunState();
}

async function runComparison() {
  const providers = getEnabledProviders();
  const schemes = getEnabledSchemes();
  const threshold = Number(refs.thresholdMeters.value || 100);
  const priority = getPriorityNames();
  const limit = Math.min(Number(refs.rowLimit.value || 10), state.rows.length, 50);
  const rows = state.rows.slice(0, limit);

  refs.runButton.disabled = true;
  refs.resultsBody.innerHTML = `<tr><td colspan="${getResultsColumnCount(providers, schemes)}">正在解析 0 / ${rows.length}</td></tr>`;
  clearMap();
  renderResultsHeader(providers, schemes);

  const results = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const providerResults = await Promise.all(providers.flatMap((provider) => schemes.map((scheme) => {
      const address = composeAddress(row, scheme.fields);
      return geocodeProvider(provider, scheme, address, row, index + 1);
    })));
    const decisionsByScheme = Object.fromEntries(schemes.map((scheme) => [
      scheme.id,
      chooseProvider(providerResults.filter((result) => result.schemeId === scheme.id), threshold, priority)
    ]));
    results.push({ row, providers: providerResults, decisionsByScheme });
    renderResults(results, providers, schemes);
    refs.mapStatus.textContent = `正在解析 ${index + 1} / ${rows.length}`;
    await pause(160);
  }

  plotResults(results);
  refs.mapStatus.textContent = `解析完成，共 ${results.length} 行。`;
  updateRunState();
}

function geocodeProvider(provider, scheme, address, row = {}, addressNumber = "") {
  if (!address) {
    return Promise.resolve({ provider: provider.name, scheme: scheme.name, schemeId: scheme.id, key: makeResultKey(provider.name, scheme.name), address, error: "地址为空" });
  }

  return fetch("/api/vendor-geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: {
        name: provider.name,
        method: provider.method || "GET",
        url: provider.url,
        params: provider.params,
        bodyParams: provider.bodyParams || [],
        latPath: provider.latPath,
        lngPath: provider.lngPath,
        labelPath: provider.labelPath
      },
      values: {
        ...createPlaceholderValues(row, address, addressNumber)
      }
    })
  })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok || payload.error) {
        return { provider: provider.name, scheme: scheme.name, schemeId: scheme.id, key: makeResultKey(provider.name, scheme.name), address, error: payload.error || `HTTP_${response.status}`, message: payload.message || "" };
      }
      return { ...payload, provider: provider.name, scheme: scheme.name, schemeId: scheme.id, key: makeResultKey(provider.name, scheme.name), address };
    })
    .catch((error) => ({ provider: provider.name, scheme: scheme.name, schemeId: scheme.id, key: makeResultKey(provider.name, scheme.name), address, error: "REQUEST_FAILED", message: error.message }));
}

function makeResultKey(providerName, schemeName) {
  return `${providerName} / ${schemeName}`;
}

function chooseProvider(providerResults, threshold, priority) {
  const valid = providerResults.filter((item) => !item.error && Number.isFinite(item.lat) && Number.isFinite(item.lng));
  const pairs = [];
  const pool = new Set();

  for (let i = 0; i < valid.length; i += 1) {
    for (let j = i + 1; j < valid.length; j += 1) {
      const distance = haversineMeters(valid[i], valid[j]);
      pairs.push({ a: valid[i].key, b: valid[j].key, distance });
      if (distance <= threshold) {
        pool.add(valid[i].key);
        pool.add(valid[j].key);
      }
    }
  }

  const candidates = pool.size ? valid.filter((item) => pool.has(item.key)) : valid;
  const selected = pickResultByPriority(candidates, priority) || valid[0] || null;
  const confidence = pool.size ? "可信" : "不可信";

  return { selected, confidence, pool: Array.from(pool), pairs };
}

function pickResultByPriority(results, priority) {
  for (const priorityName of priority) {
    const result = results.find((item) => item.provider === priorityName);
    if (result) {
      return result;
    }
  }
  return results[0] || null;
}

function renderResultsHeader(providers, schemes = getEnabledSchemes()) {
  refs.resultsHead.innerHTML = `
    <tr>
      <th>序号</th>
      <th>完整地址</th>
      <th>方案</th>
      ${providers.map((provider) => `<th>${escapeHtml(provider.name)}</th>`).join("")}
      <th>对比距离</th>
      <th>取值</th>
    </tr>
  `;
}

function renderResults(results, providers, schemes) {
  refs.resultsBody.innerHTML = "";
  results.forEach((item, index) => {
    schemes.forEach((scheme, schemeIndex) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        ${schemeIndex === 0 ? `<td rowspan="${schemes.length}">${index + 1}</td>` : ""}
        ${schemeIndex === 0 ? `<td rowspan="${schemes.length}">${escapeHtml(getFullAddress(item.row))}</td>` : ""}
        <td class="scheme-result-cell">${escapeHtml(scheme.name)}</td>
        ${renderSchemeResultColumns(item, scheme, providers)}
      `;
      refs.resultsBody.append(tr);
    });
  });
}

function renderSchemeResultColumns(item, scheme, providers) {
  const decision = item.decisionsByScheme[scheme.id] || { pairs: [], selected: null, confidence: "不可信" };
  return `
    ${providers.map((provider) => formatProviderResult(item.providers.find((result) => result.key === makeResultKey(provider.name, scheme.name)))).join("")}
    <td>${formatPairs(decision.pairs)}</td>
    <td>${formatSelectedResult(decision)}</td>
  `;
}

function getResultsColumnCount(providers, schemes) {
  return 3 + providers.length + 2;
}

function getFullAddress(row) {
  return state.headers.map((header) => row[header]).filter(Boolean).join(" / ");
}

function formatProviderResult(result) {
  if (!result || result.error) {
    return `<td><span class="error-text">${escapeHtml(result?.error || "失败")}${result?.message ? `<br>${escapeHtml(result.message)}` : ""}</span></td>`;
  }
  return `<td>${formatCoordinateWithLocate(result)}${escapeHtml(result.label || "")}</td>`;
}

function formatSelectedResult(decision) {
  if (!decision.selected) {
    return "-";
  }
  return `
    <span class="selected-provider">${escapeHtml(decision.selected.provider)}</span>
    ${formatCoordinateWithLocate(decision.selected)}
    <span class="quality ${decision.confidence === "不可信" ? "warning-quality" : ""}">${decision.confidence}</span>
  `;
}

function formatCoordinateWithLocate(result) {
  return `
    <div class="result-point">
      <span class="coord">${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}</span>
      <button class="locate-button" type="button" data-scheme-id="${escapeAttribute(result.schemeId || "")}" data-lat="${result.lat}" data-lng="${result.lng}" title="定位到地图" aria-label="定位到地图">⌖</button>
    </div>
  `;
}

function formatPairs(pairs) {
  if (!pairs.length) {
    return "-";
  }
  return `<span class="pair-list">${pairs.map((pair) => `${escapeHtml(pair.a)} 与 ${escapeHtml(pair.b)}: ${formatMeters(pair.distance)}`).join("<br>")}</span>`;
}

function formatMeters(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)}km` : `${meters.toFixed(0)}m`;
}

function handleResultLocate(event) {
  const button = event.target.closest(".locate-button");
  if (!button || !state.map) {
    return;
  }
  const lat = Number(button.dataset.lat);
  const lng = Number(button.dataset.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }
  const targetMap = state.maps.get(button.dataset.schemeId) || state.map;
  if (!targetMap) {
    return;
  }
  targetMap.panTo({ lat, lng });
  targetMap.setZoom(Math.max(targetMap.getZoom() || 0, 16));
}

function plotResults(results) {
  const providers = getEnabledProviders();
  const colors = Object.fromEntries(providers.map((provider, index) => [provider.name, getProviderColor(provider.name, index)]));
  const providerLetters = Object.fromEntries(providers.map((provider, index) => [provider.name, String.fromCharCode(65 + index)]));
  const groupsByScheme = new Map();

  results.forEach((item, index) => {
    item.providers.filter((result) => !result.error).forEach((result) => {
      const position = { lat: result.lat, lng: result.lng };
      const addressNumber = index + 1;
      const providerLetter = providerLetters[result.provider] || result.provider.slice(0, 1).toUpperCase();
      const pointLabel = `${addressNumber}${providerLetter}`;
      const groupKey = `${index + 1}|${makeCoordinateKey(position)}`;
      const schemeGroups = groupsByScheme.get(result.schemeId) || new Map();
      const existing = schemeGroups.get(groupKey) || { position, items: [] };
      existing.items.push({ ...result, label: pointLabel, providerLetter, color: colors[result.provider] });
      schemeGroups.set(groupKey, existing);
      groupsByScheme.set(result.schemeId, schemeGroups);
    });
  });

  groupsByScheme.forEach((groups, schemeId) => plotSchemeGroups(schemeId, groups));
}

function plotSchemeGroups(schemeId, groups) {
  const map = state.maps.get(schemeId);
  if (!map) {
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  groups.forEach((group) => {
    const labels = [...new Map(
      group.items
        .slice()
        .sort((first, second) => first.providerLetter.localeCompare(second.providerLetter))
        .map((item) => [item.label, item.label])
    ).values()];
    const providerCount = new Set(group.items.map((item) => item.provider)).size;
    const title = group.items.map((item) => `${item.label} ${item.key}: ${item.address}`).join("\n");
    if (providerCount > 1) {
      addMergedMarker(map, group.position, labels.join("&"), title);
    } else {
      const item = group.items[0];
      addMarker(map, group.position, labels.join("&"), item.color, title);
    }
    bounds.extend(group.position);
  });
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, 48);
  }
}

function getProviderColor(name, index) {
  const normalized = String(name || "").toLowerCase();
  if (normalized.includes("google") || normalized.includes("谷歌")) {
    return "#2f6fed";
  }
  if (normalized.includes("amazon") || normalized.includes("亚马逊")) {
    return "#f59e0b";
  }
  if (normalized.includes("microsoft") || normalized.includes("微软")) {
    return "#c81e2b";
  }
  if (normalized.includes("addressy") || normalized.includes("loqate")) {
    return "#8b5cf6";
  }
  return palette[index % palette.length];
}

function createPlaceholderValues(row, address, addressNumber) {
  const country = refs.countryCode.value.trim().toUpperCase();
  const values = {
    address,
    country,
    googleKey: refs.apiKey.value.trim(),
    id: String(addressNumber || "")
  };
  Object.entries(row || {}).forEach(([key, value]) => {
    values[key] = value ?? "";
  });
  values.Address = firstRowValue(row, ["Address", "address", "详细地址", "street", "street_address"]) || address;
  values.PostalCode = firstRowValue(row, ["PostalCode", "postalCode", "postal_code", "zip", "ZIP", "邮编"]);
  values.Country = country || firstRowValue(row, ["Country", "country", "国家"]);
  values.AdministrativeArea = firstRowValue(row, ["AdministrativeArea", "administrativeArea", "province", "state", "省", "州"]);
  values.Locality = firstRowValue(row, ["Locality", "locality", "city", "市"]);
  values.SubAdministrativeArea = firstRowValue(row, ["SubAdministrativeArea", "subAdministrativeArea", "district", "county", "区", "县"]);
  return values;
}

function firstRowValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function makeCoordinateKey(position) {
  return `${position.lat.toFixed(6)},${position.lng.toFixed(6)}`;
}

function addMergedMarker(map, position, label, title) {
  const icon = createRectangleIcon(label, "#2f8f46");
  const marker = new google.maps.Marker({
    position,
    map,
    title,
    icon
  });
  state.markers.push(marker);
}

function createRectangleIcon(label, color) {
  const textWidth = Math.max(58, label.length * 9 + 24);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${textWidth}" height="30" viewBox="0 0 ${textWidth} 30">
      <rect x="1" y="1" width="${textWidth - 2}" height="24" rx="6" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <path d="M${textWidth / 2 - 5} 24 L${textWidth / 2} 30 L${textWidth / 2 + 5} 24 Z" fill="${color}" stroke="#ffffff" stroke-width="1"/>
      <text x="${textWidth / 2}" y="17" text-anchor="middle" font-family="Arial, Microsoft YaHei, sans-serif" font-size="12" font-weight="700" fill="#ffffff">${escapeSvg(label)}</text>
    </svg>
  `.trim();
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(textWidth, 30),
    anchor: new google.maps.Point(textWidth / 2, 30)
  };
}

function addMarker(map, position, label, color, title) {
  const marker = new google.maps.Marker({
    position,
    map,
    label,
    title,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 0.95,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      scale: 10
    }
  });
  state.markers.push(marker);
}

function clearMap() {
  state.markers.forEach((marker) => marker.setMap(null));
  state.lines.forEach((line) => line.setMap(null));
  state.markers = [];
  state.lines = [];
}

function haversineMeters(a, b) {
  const earthRadius = 6371000;
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function escapeSvg(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));
}

renderSchemes();
renderResultsHeader(getEnabledProviders());
updateProviderSummary();
