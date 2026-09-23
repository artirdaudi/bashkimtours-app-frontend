import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Images, Search } from "lucide-react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import { studentsApi } from "./api";
import StudentTravelCard from "./StudentTravelCard";

const APP_ORIGIN = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
const QR_ORIGIN = `${APP_ORIGIN}/student`;
const safeName = (student) =>
  `BT${student.student_code}-${student.first_name}-${student.last_name}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-");
const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const dataUrlBlob = async (dataUrl) => (await fetch(dataUrl)).blob();
const waitForCardImages = async (node) => {
  const images = [...node.querySelectorAll("img")];
  await Promise.all(images.map(async (img) => {
    if (img.complete && !img.naturalWidth) {
      throw new Error("Imazhi i kartelës nuk mund të ngarkohet.");
    }
    if (!img.complete) {
      await new Promise((resolve, reject) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", reject, { once: true });
      });
    }
    if (typeof img.decode === "function") await img.decode().catch(() => {});
  }));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

function CardPreview({ student, qrSvg, registerCard }) {
  const boxRef = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const resize = () => setScale(box.clientWidth / 960);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="bt-card-scale-box" ref={boxRef}>
      <div className="bt-card-scale-inner" style={{ transform: `scale(${scale})` }}>
        <StudentTravelCard student={student} qrSvg={qrSvg} ref={registerCard} />
      </div>
    </div>
  );
}

export default function StudentCardsPage() {
  const [students, setStudents] = useState([]);
  const [qrCodes, setQrCodes] = useState({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");
  const cardRefs = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const all = [];
        let page = 1;
        let result;
        do {
          result = await studentsApi.list({ page, page_size: 100, sort_by: "first_name", sort_order: "asc" });
          all.push(...result.items);
          page += 1;
        } while (page <= result.total_pages);
        if (!cancelled) setStudents(all);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(students.map(async (student) => [
      student.id,
      await QRCode.toString(`${QR_ORIGIN}/${encodeURIComponent(student.qr_token)}`, {
        type: "svg", width: 420, margin: 1, errorCorrectionLevel: "H",
        color: { dark: "#061f47", light: "#ffffff" },
      }),
    ])).then((entries) => { if (!cancelled) setQrCodes(Object.fromEntries(entries)); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [students]);

  const shown = useMemo(() => {
    const words = search.toLocaleLowerCase("sq").trim().split(/\s+/).filter(Boolean);
    return students.filter((student) => {
      const haystack = `${student.first_name} ${student.last_name} ${student.student_code} ${student.area_name}`.toLocaleLowerCase("sq");
      return (!status || student.status === status) && words.every((word) => haystack.includes(word));
    });
  }, [search, status, students]);
  const qrReady = shown.length > 0 && shown.every((student) => Boolean(qrCodes[student.id]));

  const renderCard = async (student) => {
    const node = cardRefs.current.get(student.id);
    if (!node || !qrCodes[student.id]) throw new Error("Kartela ende nuk është gati.");
    await waitForCardImages(node);
    return toPng(node, { pixelRatio: 2, cacheBust: false, backgroundColor: "#ffffff", width: 960, height: 640, style: { transform: "none" } });
  };
  const downloadOne = async (student) => {
    setDownloading(String(student.id));
    setError("");
    try { saveBlob(await dataUrlBlob(await renderCard(student)), `${safeName(student)}.png`); }
    catch (err) { setError(err.message); }
    finally { setDownloading(""); }
  };
  const downloadAll = async () => {
    if (!shown.length) return;
    setDownloading("all");
    setError("");
    try {
      const zip = new JSZip();
      for (let index = 0; index < shown.length; index += 1) {
        setDownloading(`${index + 1}/${shown.length}`);
        const student = shown[index];
        zip.file(`${safeName(student)}.png`, await dataUrlBlob(await renderCard(student)));
      }
      saveBlob(await zip.generateAsync({ type: "blob" }), "bashkim-tours-kartelat.zip");
    } catch (err) { setError(err.message); }
    finally { setDownloading(""); }
  };

  return (
    <div className="bt-page bt-cards-page">
      <div className="bt-page-header">
        <div><span className="bt-eyebrow">Maarif</span><h1>Kartelat e nxënësve</h1><p>Preview, QR dhe shkarkim i kartelave si imazh.</p></div>
        <button className="bt-btn-primary" onClick={downloadAll} disabled={Boolean(downloading) || !qrReady}>
          <Images size={17} /> {downloading ? `Duke përgatitur ${downloading === "all" ? "..." : downloading}` : !qrReady && shown.length ? "Duke krijuar QR..." : `Shkarko të gjitha (${shown.length})`}
        </button>
      </div>
      <div className="bt-card-filters">
        <label><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kërko me emër, kod ose zonë..." /></label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ACTIVE">Aktiv</option><option value="INACTIVE">Jo aktiv</option><option value="">Të gjithë</option></select>
      </div>
      {error && <div className="bt-alert-error">{error}</div>}
      {loading ? <div className="bt-cards-empty">Duke ngarkuar kartelat...</div> : !shown.length ? <div className="bt-cards-empty">Nuk u gjet asnjë nxënës.</div> : (
        <div className="bt-card-preview-grid">
          {shown.map((student) => (
            <article className="bt-card-preview" key={student.id}>
              <CardPreview student={student} qrSvg={qrCodes[student.id]} registerCard={(node) => node ? cardRefs.current.set(student.id, node) : cardRefs.current.delete(student.id)} />
              <div className="bt-card-preview-meta"><div><strong>{student.first_name} {student.last_name}</strong><span>BT{student.student_code} · {student.area_name}</span></div><button onClick={() => downloadOne(student)} disabled={Boolean(downloading) || !qrCodes[student.id]} title="Shkarko kartelën"><Download /> {qrCodes[student.id] ? "Shkarko PNG" : "Duke krijuar QR..."}</button></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
