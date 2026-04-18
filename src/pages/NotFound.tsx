import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Receipt, BarChart3 } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm space-y-6">
        <div className="inline-flex items-center justify-center size-20 rounded-2xl bg-muted/50">
          <span className="text-4xl">🗺️</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Un poco perdido...</h1>
          <p className="text-sm text-muted-foreground">
            La página <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{location.pathname}</code> no existe.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">¿Quizás quisiste ir a?</p>
          <div className="flex flex-col gap-2">
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
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver atrás
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
