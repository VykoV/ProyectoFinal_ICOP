import { useState } from "react";

export default function Logo() {
  const [imgOk, setImgOk] = useState(true);
  const src = "/brand.png";
  return (
    <div className="flex items-center gap-2 select-none">
      {imgOk ? (
        <img
          src={src}
          alt="Logo"
          className="h-8 w-8 rounded-xl object-cover"
          onError={() => setImgOk(false)}
        />
      ) : (
        <div className="h-8 w-8 rounded-xl bg-black" />
      )}
      <span className="font-semibold tracking-tight">Sistema Comercial</span>
    </div>
  );
}
