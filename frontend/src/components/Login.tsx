import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../lib/api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});
type Form = z.infer<typeof schema>;

export default function Login() {


    const nav = useNavigate();
    const [err, setErr] = useState<string | null>(null);
    const { register, handleSubmit, formState: { isSubmitting, errors } } =
        useForm<Form>({ resolver: zodResolver(schema) });

    const onSubmit = async (data: Form) => {
        setErr(null);
        try {
            await api.post("/auth/login", data);

            nav("/dashboard", { replace: true });
        } catch {
            setErr("Credenciales inválidas");
        }
    };

    return (
        <div className="min-h-dvh grid place-items-center bg-gray-50 p-4">
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="w-full max-w-sm space-y-4 bg-white p-6 rounded-2xl border"
            >
                <h1 className="text-xl font-semibold">Iniciar sesión</h1>
                <div>
                    <label className="block text-sm mb-1">Email</label>
                    <input
                        className="w-full rounded-lg border px-3 py-2"
                        type="email"
                        {...register("email")}
                    />
                    {errors.email && (
                        <p className="text-xs text-red-600 mt-1">Email inválido</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm mb-1">Contraseña</label>
                    <input
                        className="w-full rounded-lg border px-3 py-2"
                        type="password"
                        {...register("password")}
                    />
                    {errors.password && (
                        <p className="text-xs text-red-600 mt-1">Mínimo 6 caracteres</p>
                    )}
                </div>
                {err && <p className="text-xs text-red-600">{err}</p>}
                <button
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-black text-white py-2"
                >
                    Entrar
                </button>
            </form>
        </div>
    );
}
