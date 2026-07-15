import {useState} from "react";
import {Head, Link, usePage} from "@inertiajs/react";
import {Button} from "../../Components/ui/button";
import {Input} from "../../Components/ui/input";
import {Label} from "../../Components/ui/label";
import {__} from "../../lib/i18n";

export default function Login({ errors, status }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const app = usePage().props.app ?? { name: "Slide Studio", short: "SS" };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await document.getElementById("login-form").submit();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--frame)] p-4">
      <Head title={__("messages.auth.login_title")} />
      <div className="auth-card">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 brand-icon size-10">
            <span className="text-sm font-bold text-white">{app.short}</span>
          </div>
          <h1 className="text-xl font-semibold">{app.name}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{__("messages.auth.login_subtitle")}</p>
        </div>

        {status && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{status}</div>
        )}

        {errors?.email && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{errors.email}</div>
        )}

        <form id="login-form" method="POST" action="/login" onSubmit={submit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{__("messages.auth.email")}</Label>
              <Input
                id="email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
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
                autoComplete="current-password"
              />
            </div>
            <label htmlFor="remember" className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] cursor-pointer select-none">
              <input
                id="remember"
                type="checkbox"
                name="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 rounded border-[var(--border)] accent-[var(--highlight)]"
              />
              {__("messages.auth.remember_me")}
            </label>
            <Button type="submit" className="w-full" disabled={submitting}>
              {__("messages.auth.login")}
            </Button>
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
          {__("messages.auth.no_account")}{" "}
          <Link href="/register" className="font-medium text-[var(--highlight)] hover:underline">
            {__("messages.auth.register")}
          </Link>
        </p>
      </div>
    </div>
  );
}
