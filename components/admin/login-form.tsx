"use client";

import { useState } from "react";

export function AdminLoginForm() {
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        remember: form.get("remember") === "on",
      }),
    });
    if (!response.ok) {
      setError("Invalid credentials.");
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        Email
        <input name="email" type="email" required className="field-input mt-1 w-full" />
      </label>
      <label className="block text-sm">
        Password
        <input name="password" type="password" required className="field-input mt-1 w-full" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="remember" type="checkbox" defaultChecked />
        Remember this device for 90 days
      </label>
      <p className="text-xs text-slate-500">Unchecked, you stay signed in for 30 days of activity. Only use this on your own device.</p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="btn btn-primary" type="submit">
        Sign in
      </button>
    </form>
  );
}
