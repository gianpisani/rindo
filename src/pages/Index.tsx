import Layout from "@/components/Layout";
import QuickTransactionForm from "@/components/QuickTransactionForm";
import BalanceSummary from "@/components/BalanceSummary";
import RecentTransactions from "@/components/RecentTransactions";

const Index = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Gestión Financiera Personal</h1>
          <p className="text-muted-foreground text-lg">
            Controla tus finanzas de manera simple y efectiva
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QuickTransactionForm />
          <div className="space-y-6">
            <BalanceSummary />
            <RecentTransactions />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
