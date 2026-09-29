import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth";
import { api } from "../services/api";

const quickAccounts = [
  { label: "Надзор", email: "nadzor@boltzzmann.kz", password: "nadzor2026" },
  { label: "Контроллер", email: "controller@boltzzmann.kz", password: "controller2026" }
];

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState(quickAccounts[0].email);
  const [password, setPassword] = useState(quickAccounts[0].password);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login({ email, password });
      login(result.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-base p-5">
      <section className="ops-panel cut-corner grid w-full max-w-5xl overflow-hidden md:grid-cols-[0.95fr_1.05fr]">
        <div className="gateway-hero p-7">
          <div className="grid h-14 w-14 place-items-center cut-corner bg-[#087F73] text-white">
            <ShieldCheck size={28} />
          </div>
          <div className="ops-label mt-8">Boltzzmann / ACCESS CONTROL</div>
          <h1 className="mt-2 text-4xl font-extrabold">Вход в систему</h1>
          <p className="mt-4 max-w-md text-muted">
            Надзор получает доступ к оперативной картине. Контроллер получает полный доступ к созданию, редактированию и удалению данных.
          </p>
          <div className="mt-6 border border-line bg-[#FAF9F5]/75 p-4">
            <div className="ops-label">ACCESS CONTROL</div>
            <p className="mt-1 text-sm text-muted">Пароли сохранены как SHA-256 hash в PostgreSQL. Для production нужен полноценный IdP/MFA.</p>
          </div>
        </div>
        <form className="bg-[#FAF9F5] p-7" onSubmit={submit}>
          <div className="ops-label">IDENTITY TERMINAL</div>
          <label className="mt-5 block text-sm font-extrabold text-muted">Email</label>
          <input className="mono mt-2 w-full border border-line bg-white px-4 py-3" value={email} onChange={(event) => setEmail(event.target.value)} />
          <label className="mt-4 block text-sm font-extrabold text-muted">Пароль</label>
          <input className="mono mt-2 w-full border border-line bg-white px-4 py-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="btn btn-primary cut-corner mt-6 w-full" disabled={busy}>
            <LockKeyhole size={17} /> {busy ? "Проверка..." : "Войти"}
          </button>
          {error && <p className="mt-4 border border-[#D92D20]/30 bg-[#fff0ef] p-3 text-sm font-bold text-[#D92D20]">{error}</p>}
          <div className="mt-6 grid gap-2">
            {quickAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                className="btn justify-between"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              >
                <span>{account.label}</span>
                <span className="mono text-xs">{account.email}</span>
              </button>
            ))}
          </div>
        </form>
      </section>
    </main>
  );
}
