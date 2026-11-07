import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Boton, Mensaje } from "./ui";

const MAX_ARCHIVOS = 5;
const MAX_BYTES = 20 * 1024 * 1024;
const formatos = /\.(ppt|pptx|pdf|doc|docx)$/i;
const identidad = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

export default function ArchivosContexto({
  archivos,
  onChange,
  demo,
}: {
  archivos: File[];
  onChange: (archivos: File[]) => void;
  demo: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  function agregar(nuevos: File[]) {
    const siguientes = [...archivos];
    const errores: string[] = [];
    for (const archivo of nuevos) {
      if (!formatos.test(archivo.name)) {
        errores.push(`${archivo.name}: usa PPT, PPTX, PDF, DOC o DOCX.`);
        continue;
      }
      if (!archivo.size) {
        errores.push(`${archivo.name}: el archivo está vacío.`);
        continue;
      }
      if (archivo.size > MAX_BYTES) {
        errores.push(`${archivo.name}: supera los 20 MB.`);
        continue;
      }
      if (siguientes.some((f) => identidad(f) === identidad(archivo))) continue;
      if (siguientes.length >= MAX_ARCHIVOS) {
        errores.push("Puedes añadir hasta 5 archivos.");
        break;
      }
      siguientes.push(archivo);
    }
    onChange(siguientes);
    setError(errores.join(" "));
  }
  return (
    <section className="context-files" aria-labelledby="context-files-title">
      <div
        className={`context-upload ${arrastrando ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setArrastrando(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          agregar(Array.from(e.dataTransfer.files));
        }}
      >
        <span className="context-file-icon">
          <FileText size={21} />
        </span>
        <div className="context-upload-copy">
          <h3 id="context-files-title">
            Añade contexto para Evalia <span>Opcional</span>
          </h3>
          <p>Tus diapositivas o informe para acompañar el ensayo.</p>
          <small>Arrastra aquí · PPT, PPTX, PDF, DOC y DOCX</small>
        </div>
        <Boton
          type="button"
          variante="secondary"
          onClick={() => input.current?.click()}
        >
          <Upload size={16} />
          Subir archivos
        </Boton>
        <input
          ref={input}
          className="sr-only"
          type="file"
          multiple
          accept=".ppt,.pptx,.pdf,.doc,.docx"
          aria-label="Seleccionar contenidos de contexto"
          tabIndex={-1}
          onChange={(e) => {
            agregar(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      <p className="context-file-limits">
        Hasta 5 archivos · Máximo 20 MB por archivo
      </p>
      {archivos.length > 0 && (
        <ul className="context-file-list">
          {archivos.map((f) => (
            <li key={identidad(f)}>
              <FileText size={17} />
              <div>
                <strong>{f.name}</strong>
                <small>
                  {f.size < 1024 * 1024
                    ? `${Math.max(1, Math.round(f.size / 1024))} KB`
                    : `${(f.size / 1024 / 1024).toFixed(1)} MB`}{" "}
                  · Seleccionado
                </small>
              </div>
              <button
                type="button"
                aria-label={`Quitar ${f.name}`}
                onClick={() => {
                  onChange(
                    archivos.filter((a) => identidad(a) !== identidad(f)),
                  );
                  setError("");
                }}
              >
                <X size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="context-file-status" role="status">
        {demo
          ? "En demo puedes seleccionar archivos, pero no se envían ni cambian los resultados simulados."
          : "Archivos seleccionados solo en este dispositivo. Su envío y lectura estarán disponibles al conectar el backend de documentos."}
      </p>
      {error && <Mensaje error>{error}</Mensaje>}
    </section>
  );
}
