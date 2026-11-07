import { ScanFace } from "lucide-react";
export default function CamaraDemo({
  revision = false,
}: {
  revision?: boolean;
}) {
  return (
    <div className="demo-camera">
      <div className="camera-grid" />
      <div className="frame-corner tl" />
      <div className="frame-corner tr" />
      <div className="frame-corner bl" />
      <div className="frame-corner br" />
      <svg className="body-preview" viewBox="0 0 400 480" aria-hidden="true">
        <defs>
          <linearGradient id="bodyFill" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#746095" stopOpacity=".25" />
            <stop offset="1" stopColor="#a78bfa" stopOpacity=".06" />
          </linearGradient>
        </defs>
        <ellipse
          cx="200"
          cy="438"
          rx="125"
          ry="14"
          fill="#a78bfa"
          opacity=".06"
        />
        <path
          d="M170 135 Q140 147 130 185 L98 287 Q95 306 109 311 Q123 317 130 294 L156 224 L156 325 L148 426 Q149 443 166 443 Q179 443 180 427 L199 330 L218 427 Q220 443 234 443 Q252 442 249 425 L242 325 L242 225 L270 294 Q277 314 290 310 Q305 305 298 287 L266 186 Q257 148 228 135Z"
          fill="url(#bodyFill)"
          stroke="#9277ba"
          strokeWidth="1.5"
        />
        <ellipse
          cx="199"
          cy="91"
          rx="44"
          ry="53"
          fill="url(#bodyFill)"
          stroke="#9277ba"
          strokeWidth="1.5"
        />
        <g
          stroke="#a78bfa"
          opacity=".7"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          fill="none"
        >
          <path d="M199 90 L157 170 L242 170 Z M157 170 L130 247 L109 300 M242 170 L268 247 L289 300 M157 170 L172 312 L225 312 L242 170 M172 312 L165 427 M225 312 L235 427" />
          <rect x="144" y="30" width="110" height="130" rx="40" />
        </g>
        <g fill="#b69aff">
          {[
            [199, 90],
            [182, 80],
            [216, 80],
            [157, 170],
            [242, 170],
            [130, 247],
            [268, 247],
            [109, 300],
            [289, 300],
            [172, 312],
            [225, 312],
            [165, 427],
            [235, 427],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" />
          ))}
        </g>
      </svg>
      <div className="camera-demo-text">
        <ScanFace size={19} />
        <strong>
          {revision
            ? "Intento de demostración listo"
            : "Este es tu espacio para practicar"}
        </strong>
        <span>
          {revision
            ? "No se ha creado ningún archivo de audio o video."
            : "Vista y seguimiento simulados · Cámara apagada"}
        </span>
      </div>
    </div>
  );
}
