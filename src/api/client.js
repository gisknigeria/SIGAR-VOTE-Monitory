import { API } from "../config.js";

const safeApiErrorMessage = (status, body, contentType = "") => {
  const message = typeof body === "object" && body
    ? body?.message
    : typeof body === "string"
      ? body.trim()
      : "";
  const isHtml = contentType.toLowerCase().includes("text/html")
    || /<!doctype\s+html|<html[\s>]|<style[\s>]|data:font\//i.test(message);

  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (!isHtml && message && message.length <= 300) return message;
  if (status >= 500) return "Service temporarily unavailable. Please try again shortly.";
  return `Request failed (${status})`;
};

export async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const body = response.status === 204
    ? null
    : contentType.includes("application/json")
      ? await response.json()
      : await response.text();

  if (!response.ok) {
    const error = new Error(safeApiErrorMessage(response.status, body, contentType));
    error.code = typeof body === "object" && body ? body.code : "";
    error.status = response.status;
    throw error;
  }

  return body;
}
