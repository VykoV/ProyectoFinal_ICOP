import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme, DEFAULT } from "../context/ThemeProvider";

export default function ConfiguracionApariencia() {
  const { user, hasRole } = useAuth();
  const { global, userOverrides, effective, previewUpdate, updateGlobal, saveGlobal, saveUser } = useTheme();

  const [color, setColor] = useState(effective.primaryHex);
  const [dark, setDark] = useState(effective.dark);
  const [density, setDensity] = useState(effective.density);
  const [radius, setRadius] = useState(effective.radiusPx);
  const [fontScale, setFontScale] = useState(effective.fontScale);

  useEffect(() => {
    setColor(effective.primaryHex);
    setDark(effective.dark);
    setDensity(effective.density);
    setRadius(effective.radiusPx);
    setFontScale(effective.fontScale);
  }, [effective.primaryHex, effective.dark, effective.density, effective.radiusPx, effective.fontScale]);

  function onPreview() {
    previewUpdate({ primaryHex: color, dark, density, radiusPx: radius, fontScale });
  }

  function onResetDefaults() {
    setColor(DEFAULT.primaryHex);
    setDark(DEFAULT.darkDefault);
    setDensity(DEFAULT.density);
    setRadius(DEFAULT.radiusPx);
    setFontScale(DEFAULT.fontScale);
    previewUpdate({
      primaryHex: DEFAULT.primaryHex,
      dark: DEFAULT.darkDefault,
      density: DEFAULT.density,
      radiusPx: DEFAULT.radiusPx,
      fontScale: DEFAULT.fontScale,
    });
  }

  async function onSaveGlobal() {
    updateGlobal({ primaryHex: color, dark, density, radiusPx: radius, fontScale });
    await saveGlobal();
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Configuración → Apariencia</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Color primario</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 h-10 p-0 border rounded" />
          </div>
          <div className="flex items-center gap-3">
            <input id="dark" type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />
            <label htmlFor="dark" className="text-sm">Modo oscuro</label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Densidad</label>
            <select value={density} onChange={(e) => setDensity(e.target.value as any)} className="border rounded px-2 py-1">
              <option value="COMPACT">Compacta</option>
              <option value="COZY">Cómoda</option>
              <option value="COMFORTABLE">Amplia</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Radio de borde: {radius}px</label>
            <input type="range" min={0} max={24} step={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Escala tipográfica: {fontScale.toFixed(2)}x</label>
            <input type="range" min={0.9} max={1.2} step={0.01} value={fontScale} onChange={(e) => setFontScale(Number(e.target.value))} className="w-full" />
          </div>
          <div className="flex gap-2">
            <button onClick={onPreview} className="px-3 py-2 bg-primary text-white radius-var">Vista previa</button>
            <button onClick={onResetDefaults} className="px-3 py-2 border border-primary text-primary radius-var">Restablecer configuración predeterminada</button>
            {hasRole("Administrador") && (
              <button onClick={onSaveGlobal} className="px-3 py-2 border border-primary text-primary radius-var">Guardar global</button>
            )}
            {user && (
              <button onClick={saveUser} className="px-3 py-2 border border-primary text-primary radius-var">Guardar mi preferencia</button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 border rounded radius-var">
            <div className="mb-3">
              <span className="text-sm text-gray-500">Vista previa</span>
            </div>
            <div className="space-y-3">
              <button className="px-4 py-2 bg-primary text-white radius-var">Botón primario</button>
              <div className="p-3 border rounded radius-var">
                <div className="table-row flex justify-between">
                  <span>Fila de tabla</span>
                  <span className="text-right">123.456,00</span>
                </div>
                <div className="table-row flex justify-between">
                  <span>Fila de tabla</span>
                  <span className="text-right">789,00</span>
                </div>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <p>Global actual: color {global.primaryHex}, radio {global.radiusPx}px, escala {global.fontScale}x, densidad {global.density}, dark por defecto {global.darkDefault ? "sí" : "no"}.</p>
            <p>Overrides del usuario: {JSON.stringify(userOverrides)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}