import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Row, Panel } from "@/components/HairlineGrid";
import { Home, ArrowLeft, Receipt, BarChart3 } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  /* Esta página no tiene Layout ni primera pantalla que repartir: es un
     bloque centrado. Así que no se fuerza el Screen, pero sí el
     vocabulario — un solo bloque con borde y sus tres celdas separadas
     por 1px, en vez de tres cajas flotando con aire entre ellas. */
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Row className="w-full max-w-sm border border-border">
        {/* ── Identidad ─────────────────────────────────────────── */}
        <Panel className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center border border-border text-xl">
              🗺️
            </div>
            <div className="min-w-0">
              <p className="eyebrow">Error 404</p>
              <h1 className="page-title mt-1 text-2xl">Un poco perdido</h1>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            La ruta{" "}
            <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {location.pathname}
            </code>{" "}
            no existe.
          </p>
        </Panel>

        {/* ── Los destinos ──────────────────────────────────────── */}
        <Panel className="px-5 py-4">
          <p className="eyebrow">Quizás quisiste ir a</p>
          <div className="mt-3 flex flex-col gap-2">
            <Button asChild variant="default" className="w-full gap-2">
              <Link to="/">
                <Home className="h-4 w-4" />
                Inicio
              </Link>
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/transactions">
                  <Receipt className="h-3.5 w-3.5" />
                  Movimientos
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/finances">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Finanzas
                </Link>
              </Button>
            </div>
          </div>
        </Panel>

        {/* ── Volver. Bloque plano a lo ancho, no un botón flotando. */}
        <Panel>
          <button
            onClick={() => window.history.back()}
            className="native-press flex w-full items-center justify-center gap-1.5 px-5 py-3 text-xs text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver atrás
          </button>
        </Panel>
      </Row>
    </div>
  );
};

export default NotFound;
