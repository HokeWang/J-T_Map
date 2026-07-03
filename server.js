const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.PORT || 5174);
const root = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname === "/api/geocode") {
    await handleGeocode(request, response);
    return;
  }

  if (requestUrl.pathname === "/api/vendor-geocode") {
    await handleVendorGeocode(request, response);
    return;
  }

  const safePath = path.normalize(decodeURIComponent(requestUrl.pathname)).replace(/^([/\\])+/, "");
  const filePath = path.join(root, safePath || "index.html");

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  });
});

server.listen(port, () => {
  console.log(`Address geocoding comparison running at http://localhost:${port}`);
});

async function handleGeocode(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const key = String(body.key || "").trim();
    const address = String(body.address || "").trim();
    const country = String(body.country || "").trim();

    if (!key || !address) {
      sendJson(response, 400, { error: "MISSING_REQUIRED_FIELDS", message: "key and address are required." });
      return;
    }

    const googleUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    googleUrl.searchParams.set("key", key);
    googleUrl.searchParams.set("address", address);
    if (country) {
      googleUrl.searchParams.set("country", country);
    }

    const googleResponse = await requestJson(googleUrl);
    const firstResult = Array.isArray(googleResponse.results) ? googleResponse.results[0] : null;
    const location = firstResult?.geometry?.location;

    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      sendJson(response, 200, {
        error: googleResponse.status || "ZERO_RESULTS",
        message: googleResponse.error_message || "Google returned no usable geometry.location.",
        resultsCount: Array.isArray(googleResponse.results) ? googleResponse.results.length : 0
      });
      return;
    }

    sendJson(response, 200, {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: firstResult.formatted_address || "",
      locationType: firstResult.geometry.location_type || "UNKNOWN",
      partialMatch: Boolean(firstResult.partial_match),
      placeId: firstResult.place_id || "",
      status: googleResponse.status || "OK",
      resultsCount: googleResponse.results.length
    });
  } catch (error) {
    sendJson(response, 500, { error: "GEOCODE_PROXY_ERROR", message: error.message });
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const method = options.method || "GET";
    const body = options.body ? JSON.stringify(options.body) : null;
    const requestOptions = {
      method,
      headers: body
        ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body)
          }
        : undefined
    };

    const req = https
      .request(url, requestOptions, (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(responseBody || "{}");
            parsed.__httpStatus = res.statusCode;
            resolve(parsed);
          } catch {
            resolve({
              __httpStatus: res.statusCode,
              __rawBody: responseBody.slice(0, 300)
            });
          }
        });
      })
      .on("error", reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function handleVendorGeocode(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const provider = body.provider || {};
    const values = body.values || {};
    const targetUrl = String(provider.url || "").trim();

    if (!targetUrl || !provider.latPath || !provider.lngPath) {
      sendJson(response, 400, { error: "MISSING_PROVIDER_CONFIG", message: "url, latPath, and lngPath are required." });
      return;
    }

    const vendorUrl = new URL(targetUrl);
    const vendorMethod = String(provider.method || "GET").toUpperCase() === "POST" ? "POST" : "GET";
    for (const param of provider.params || []) {
      if (!param.key) {
        continue;
      }
      const value = replacePlaceholders(String(param.value || ""), values);
      if (value) {
        vendorUrl.searchParams.set(param.key, value);
      }
    }

    const vendorBody = {};
    for (const param of provider.bodyParams || []) {
      if (!param.key) {
        continue;
      }
      const value = replacePlaceholders(String(param.value || ""), values);
      if (value) {
        setPath(vendorBody, param.key, coerceBodyValue(value));
      }
    }

    const vendorResponse = await requestJson(vendorUrl, {
      method: vendorMethod,
      body: vendorMethod === "POST" ? vendorBody : null
    });
    if (vendorResponse.__httpStatus >= 400) {
      sendJson(response, 200, {
        error: `VENDOR_HTTP_${vendorResponse.__httpStatus}`,
        message: extractVendorErrorMessage(vendorResponse)
      });
      return;
    }

    if (vendorResponse.status && vendorResponse.status !== "OK" && vendorResponse.error_message) {
      sendJson(response, 200, {
        error: vendorResponse.status,
        message: vendorResponse.error_message
      });
      return;
    }

    const lat = Number(readPath(vendorResponse, provider.latPath));
    const lng = Number(readPath(vendorResponse, provider.lngPath));
    const label = provider.labelPath ? String(readPath(vendorResponse, provider.labelPath) || "") : "";

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      sendJson(response, 200, {
        error: "NO_USABLE_LOCATION",
        message: "The configured JSON paths did not return numeric lat/lng values."
      });
      return;
    }

    sendJson(response, 200, { lat, lng, label });
  } catch (error) {
    sendJson(response, 200, { error: "VENDOR_PROXY_ERROR", message: error.message });
  }
}

function replacePlaceholders(value, values) {
  return value.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => String(values[key.trim()] || ""));
}

function coerceBodyValue(value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}

function setPath(target, pathExpression, value) {
  const parts = String(pathExpression || "").split(".").filter(Boolean);
  let current = target;
  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;
    const nextPart = parts[index + 1];
    const nextValue = /^\d+$/.test(nextPart) ? [] : {};
    if (Array.isArray(current)) {
      const arrayIndex = Number(part);
      if (isLast) {
        current[arrayIndex] = value;
      } else {
        current[arrayIndex] = current[arrayIndex] || nextValue;
        current = current[arrayIndex];
      }
      return;
    }
    if (isLast) {
      current[part] = value;
      return;
    }
    current[part] = current[part] || nextValue;
    current = current[part];
  });
}

function extractVendorErrorMessage(payload) {
  return String(
    payload.error?.message ||
      payload.error_description ||
      payload.errorMessage ||
      payload.message ||
      payload.__rawBody ||
      "Vendor returned an error response."
  );
}

function readPath(source, pathExpression) {
  return String(pathExpression || "").split(".").filter(Boolean).reduce((current, part) => {
    if (current === undefined || current === null) {
      return undefined;
    }
    return current[part];
  }, source);
}