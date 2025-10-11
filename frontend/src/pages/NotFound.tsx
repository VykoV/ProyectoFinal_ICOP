import { Link } from "react-router-dom";
export default function NotFound() {
    return (
        <div className="min-h-dvh grid place-items-center p-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">404</h1>
                <p>Página no encontrada</p>
                <Link to="/" className="text-black underline">
                    Volver
                </Link>
            </div>
        </div>
    );
}
