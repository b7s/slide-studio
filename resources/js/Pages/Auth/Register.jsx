import { useState } from "react";
import { Head, Link, usePage } from "@inertiajs/react";
import { Button } from "../../Components/ui/button";
import { Input } from "../../Components/ui/input";
import { Label } from "../../Components/ui/label";
import { __ } from "../../lib/i18n";

export default function Register({ errors }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const app = usePage().props.app ?? { name: "Slide Studio", short: "SS" };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await document.getElementById("register-form").submit();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--frame)] p-4">
      <Head title={__("messages.auth.register_title")} />
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-lg bg-gradient-to-br from-[#16283a] to-[#0a141d]">
            <span className="text-sm font-bold text-white">{app.short}</span>
          </div>
          <h1 className="text-xl font-semibold">{app.name}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{__("messages.auth.register_subtitle")}</p>
        </div>

        {errors?.email && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{errors.email}</div>
        )}

        <form id="register-form" method="POST" action="/register" onSubmit={submit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{__("messages.auth.name")}</Label>
              <Input
                id="name"
                type="text"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                autoComplete="name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">{__("messages.auth.email")}</Label>
              <Input
                id="email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{__("messages.auth.password")}</Label>
              <Input
                id="password"
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password_confirmation">{__("messages.auth.confirm_password")}</Label>
              <Input
                id="password_confirmation"
                type="password"
                name="password_confirmation"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {__("messages.auth.register")}
            </Button>
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
          {__("messages.auth.has_account")}{" "}
          <Link href="/login" className="font-medium text-[var(--gold)] hover:underline">
            {__("messages.auth.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}