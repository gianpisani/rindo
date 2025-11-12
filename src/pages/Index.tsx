import Layout from "@/components/Layout";
import QuickTransactionForm from "@/components/QuickTransactionForm";
import RecentTransactions from "@/components/RecentTransactions";

const Index = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QuickTransactionForm />
          <RecentTransactions />
        </div>
      </div>
    </Layout>
  );
};

export default Index;
