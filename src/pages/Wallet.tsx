import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Copy, 
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  CreditCard,
  Shield,
  Wifi,
  Lock,
  X,
  Smartphone,
  Banknote,
  User,
  Mail,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import payvendasLogo from "@/assets/payvendas-logo.png";
import paypayLogo from "@/assets/paypay-logo.webp";
import multicaixaLogo from "@/assets/multicaixa-logo.webp";
import pliqpagLogo from "@/assets/pliqpag-logo.png";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  method: string | null;
  created_at: string;
  description: string | null;
}

const PAYMENT_METHODS = [
  { id: 'multicaixa', name: 'Multicaixa Express', icon: multicaixaLogo, color: 'bg-orange-500/20' },
  { id: 'paypay', name: 'PayPay África', icon: paypayLogo, color: 'bg-cyan-500/20' },
];

interface PaymentWebhookResponse {
  success?: boolean;
  error?: string;
  transaction_id?: string;
  reference?: string;
  plinqpay_id?: string;
  entity?: string;
  message?: string;
}

const Wallet = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState<'cartao' | 'historico'>('cartao');
  
  // Deposit/Withdraw modals
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [showLoadingSplash, setShowLoadingSplash] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Gerando referência...");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentEntity, setPaymentEntity] = useState("01055");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0]);
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  // Checkout form fields
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientIban, setClientIban] = useState("");

  useEffect(() => {
    if (user) {
      fetchTransactions();
      // Pre-fill from profile
      if (profile) {
        setClientName(profile.full_name || "");
        setClientPhone(profile.phone?.replace("+244", "") || "");
      }
      if (user.email) {
        setClientEmail(user.email);
      }
    }
  }, [user, profile]);

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (data) {
      setTransactions(data);
    }
  };

  const callPaymentWebhook = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('payment-webhook', { body: payload });

    if (error) {
      throw new Error(error.message || 'Erro de comunicação com o servidor de pagamentos');
    }

    const response = (data || {}) as PaymentWebhookResponse;
    if (response.error) {
      throw new Error(response.error);
    }

    return response;
  };

  const copyIban = () => {
    if (profile?.iban_virtual) {
      navigator.clipboard.writeText(profile.iban_virtual);
      setCopied(true);
      toast.success("IBAN copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const validateCheckoutForm = (isWithdraw = false) => {
    if (!clientName.trim()) {
      toast.error("Nome completo é obrigatório");
      return false;
    }
    if (!clientEmail.trim() || !clientEmail.includes("@")) {
      toast.error("Email válido é obrigatório");
      return false;
    }

    if (isWithdraw) {
      const ibanNormalized = clientIban.replace(/\s+/g, "").toUpperCase();
      if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(ibanNormalized)) {
        toast.error("IBAN válido é obrigatório para levantamento manual");
        return false;
      }
      return true;
    }

    if (!clientPhone.trim() || clientPhone.replace(/\D/g, "").length < 9) {
      toast.error("Número de telefone válido é obrigatório");
      return false;
    }
    return true;
  };

  // Deposit: checkout form -> loading -> show reference
  const handleDeposit = async () => {
    if (!user || !profile) return;
    
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount < 12) {
      toast.error("Valor mínimo de depósito: 12 AOA");
      return;
    }
    if (depositAmount > 1000000) {
      toast.error("Valor máximo de depósito: 1.000.000 AOA");
      return;
    }
    if (!validateCheckoutForm(false)) return;

    setShowDepositModal(false);
    setShowLoadingSplash(true);
    setLoadingMessage("Gerando referência de pagamento...");

    try {
      const phoneFormatted = clientPhone.replace(/\D/g, "");
      const result = await callPaymentWebhook({
        action: 'initiate',
        type: 'deposit',
        amount: depositAmount,
        method: selectedMethod.name,
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        client_phone: phoneFormatted,
      });

      setPaymentReference(result.reference || result.plinqpay_id || '');
      setPaymentEntity(result.entity || '01055');
      setPaymentAmount(depositAmount);
      setShowLoadingSplash(false);
      setShowPaymentInfo(true);
      setAmount("");
      fetchTransactions();
    } catch (error: any) {
      setShowLoadingSplash(false);
      toast.error(error.message || "Erro ao processar depósito");
    }
  };

  // Withdrawal: checkout form -> loading -> confirm
  const handleWithdraw = async () => {
    if (!user || !profile) return;
    
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount < 200) {
      toast.error("Valor mínimo de levantamento: 200 AOA");
      return;
    }
    if (withdrawAmount > 200000) {
      toast.error("Valor máximo de levantamento: 200.000 AOA");
      return;
    }
    if ((profile.balance || 0) < withdrawAmount) {
      toast.error("Saldo insuficiente");
      return;
    }
    if (!validateCheckoutForm(true)) return;

    setShowWithdrawModal(false);
    setShowLoadingSplash(true);
    setLoadingMessage("Processando levantamento manual...");

    try {
      const ibanFormatted = clientIban.replace(/\s+/g, '').toUpperCase();

      await callPaymentWebhook({
        action: 'initiate',
        type: 'withdrawal',
        amount: withdrawAmount,
        method: 'Manual IBAN',
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        client_iban: ibanFormatted,
      });

      setShowLoadingSplash(false);
      toast.success(
        <div className="space-y-2">
          <p className="font-semibold">Levantamento manual solicitado!</p>
          <p className="text-xs">Seu saque de {withdrawAmount.toLocaleString('pt-AO')} AOA será processado manualmente pelo admin para o IBAN {ibanFormatted}.</p>
        </div>,
        { duration: 10000 }
      );

      setAmount("");
      refreshProfile();
      fetchTransactions();
    } catch (error: any) {
      setShowLoadingSplash(false);
      toast.error(error.message || "Erro ao processar levantamento");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="text-emerald-500" size={14} />;
      case "pending":
        return <Clock className="text-amber-500" size={14} />;
      case "failed":
        return <XCircle className="text-red-500" size={14} />;
      default:
        return null;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownLeft className="text-emerald-500" size={16} />;
      case "withdrawal":
        return <ArrowUpRight className="text-amber-500" size={16} />;
      default:
        return <CreditCard className="text-muted-foreground" size={16} />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'Depósito';
      case 'withdrawal': return 'Levantamento';
      case 'wallet_activation': return 'Ativação Carteira';
      case 'pdf_purchase': return 'Compra PDF';
      case 'trade': return 'Trading';
      case 'chuva_sent': return 'Chuva Enviada';
      case 'chuva_received': return 'Chuva Recebida';
      default: return type;
    }
  };

  const balance = profile?.balance || 0;

  // Checkout form component
  const CheckoutForm = ({ isWithdraw = false }: { isWithdraw?: boolean }) => (
    <div className="space-y-3">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-1">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-primary" />
          <span className="font-semibold text-foreground text-sm">Checkout Seguro</span>
        </div>
        <p className="text-muted-foreground text-xs">
          Preencha seus dados para {isWithdraw ? 'receber o pagamento' : 'gerar a referência de pagamento'}.
        </p>
      </div>

      <div>
        <Label className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1.5">
          <User size={14} /> Nome Completo *
        </Label>
        <Input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Seu nome completo"
          className="bg-secondary border-border text-foreground"
        />
      </div>

      <div>
        <Label className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1.5">
          <Mail size={14} /> Email *
        </Label>
        <Input
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="seu@email.com"
          className="bg-secondary border-border text-foreground"
        />
      </div>

      <div>
        <Label className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1.5">
          <Phone size={14} /> {isWithdraw ? 'IBAN de Destino *' : 'Número de Telefone *'}
        </Label>
        <Input
          type="text"
          value={isWithdraw ? clientIban : clientPhone}
          onChange={(e) => isWithdraw ? setClientIban(e.target.value.toUpperCase()) : setClientPhone(e.target.value)}
          placeholder={isWithdraw ? "AO06xxxxxxxxxxxxxxxxxxxx" : "923456789"}
          className="bg-secondary border-border text-foreground"
        />
      </div>

      <div>
        <Label className="text-sm text-muted-foreground block mb-2">
          {isWithdraw ? 'Processamento' : 'Método de Pagamento'}
        </Label>
        {isWithdraw ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
            Levantamento manual por IBAN (processado pelo admin)
          </div>
        ) : (
          <div className="space-y-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  selectedMethod.id === method.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg ${method.color} flex items-center justify-center p-1.5`}>
                  <img src={method.icon} alt={method.name} className="w-full h-full object-contain" />
                </div>
                <span className="text-foreground font-medium">{method.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="text-sm text-muted-foreground block mb-1.5">Valor (AOA) *</Label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={isWithdraw ? "Mínimo: 200 AOA" : "Mínimo: 12 AOA"}
          className="bg-secondary border-border text-foreground"
        />
      </div>

      {isWithdraw && (
        <div className="bg-secondary rounded-xl p-3">
          <div className="text-xs text-muted-foreground mb-1">Saldo Disponível</div>
          <div className="text-lg font-bold text-foreground">
            {balance.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} AOA
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 liquid-glass border-b border-border/50">
        <h1 className="font-display text-xl font-bold text-foreground mb-1">Carteira</h1>
        <p className="text-muted-foreground text-sm">Gerencie seus fundos e cartão virtual</p>
      </div>

      {/* Balance Card */}
      <div className="px-4 py-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary via-primary to-orange-600 rounded-2xl p-5 text-white relative overflow-hidden shadow-xl shadow-primary/30"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white/80 text-sm">Saldo Disponível</span>
              <button 
                onClick={() => setShowBalance(!showBalance)}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <div className="text-3xl font-bold mb-6 font-mono">
              {showBalance ? `${balance.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} AOA` : '••••••'}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button 
                className="bg-white text-primary hover:bg-white/90 h-11 font-semibold shadow-md"
                onClick={() => setShowDepositModal(true)}
              >
                <ArrowDownLeft size={16} className="mr-2" />
                Depositar
              </Button>
              <Button 
                className="bg-white/20 text-white hover:bg-white/30 border border-white/30 h-11 font-semibold"
                onClick={() => setShowWithdrawModal(true)}
              >
                <ArrowUpRight size={16} className="mr-2" />
                Levantar
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 mb-4">
        <div className="flex bg-secondary rounded-xl p-1 border border-border">
          <button
            onClick={() => setActiveTab('cartao')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'cartao' 
                ? 'bg-primary text-white' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Cartão Virtual
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'historico' 
                ? 'bg-primary text-white' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Histórico
          </button>
        </div>
      </div>

      <div className="px-4">
        {activeTab === 'cartao' ? (
          <div className="space-y-4">
            {/* Virtual Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-foreground via-foreground/90 to-foreground/80 rounded-2xl p-5 relative overflow-hidden border border-primary/30"
              style={{ aspectRatio: '1.586' }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <img src={payvendasLogo} alt="PayVendas" className="h-6" />
                  <div className="flex items-center gap-1">
                    <Wifi size={14} className="text-primary" />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="w-10 h-7 rounded bg-gradient-to-br from-amber-300 to-amber-500">
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-px p-0.5">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="rounded-[1px] bg-amber-600/50" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-auto">
                  <div className="text-[10px] uppercase mb-0.5 text-white/60">IBAN Virtual</div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-white">
                      {profile?.iban_virtual || '••••••••••••••••'}
                    </code>
                    <button 
                      onClick={copyIban}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      {copied ? <CheckCircle size={14} className="text-primary" /> : <Copy size={14} className="text-white/60" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between mt-3">
                  <div>
                    <div className="text-[10px] uppercase text-white/60">Titular</div>
                    <div className="text-xs font-medium text-white">
                      {profile?.full_name || 'NOME DO TITULAR'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-white/60">Status</div>
                    <div className="text-xs font-medium text-primary">ATIVO</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          /* Transaction History */
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full h-10 border-border text-foreground hover:bg-secondary"
              onClick={() => {
                fetchTransactions();
                refreshProfile();
                toast.success("Atualizado!");
              }}
            >
              <RefreshCw size={14} className="mr-2" />
              Atualizar
            </Button>

            {transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard size={40} className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">Sem transações</p>
              </div>
            ) : (
              transactions.map((tx, index) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center justify-between p-3 rounded-xl liquid-glass"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      tx.type === "deposit" ? "bg-emerald-500/10" : 
                      tx.type === "withdrawal" ? "bg-amber-500/10" : "bg-muted"
                    }`}>
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {getTransactionLabel(tx.type)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {tx.method || 'PayVendas'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${
                      tx.type === "deposit" || tx.type === "chuva_received" ? "text-emerald-500" : "text-amber-500"
                    }`}>
                      {tx.type === "deposit" || tx.type === "chuva_received" ? "+" : "-"}
                      {tx.amount.toLocaleString('pt-AO')} AOA
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString('pt-AO')}
                      </span>
                      {getStatusIcon(tx.status)}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      <BottomNavigation />

      {/* Loading Splash Screen */}
      <AnimatePresence>
        {showLoadingSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 rounded-full border-4 border-muted border-t-primary mb-6"
            />
            <img src={payvendasLogo} alt="PayVendas" className="h-10 mb-4" />
            <p className="text-foreground font-semibold text-lg">{loadingMessage}</p>
            <p className="text-muted-foreground text-sm mt-2">Aguarde um momento...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deposit Modal with Checkout */}
      <AnimatePresence>
        {showDepositModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4"
            onClick={() => setShowDepositModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="liquid-glass rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-foreground">Depositar</h3>
                <button onClick={() => setShowDepositModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={20} />
                </button>
              </div>

              <CheckoutForm />

              <Button
                onClick={handleDeposit}
                disabled={processing || !amount || !clientName || !clientEmail || !clientPhone}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md mt-4"
              >
                <CreditCard size={16} className="mr-2" />
                Gerar Referência de Pagamento
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw Modal with Checkout */}
      <AnimatePresence>
        {showWithdrawModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4"
            onClick={() => setShowWithdrawModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="liquid-glass rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-foreground">Levantar</h3>
                <button onClick={() => setShowWithdrawModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={20} />
                </button>
              </div>

              <CheckoutForm isWithdraw />

              <Button
                onClick={handleWithdraw}
                disabled={processing || !amount || !clientName || !clientEmail || !clientPhone}
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md mt-4"
              >
                Solicitar Levantamento
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Reference Info Modal */}
      <AnimatePresence>
        {showPaymentInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPaymentInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="liquid-glass rounded-2xl w-full max-w-sm p-6 shadow-xl text-center"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-primary" size={28} />
              </div>
              
              <h3 className="font-bold text-lg text-foreground mb-2">Referência de Pagamento</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Pague via Multicaixa Express ou PayPay África com os dados abaixo:
              </p>

              <div className="space-y-3 bg-secondary rounded-xl p-4 text-left mb-5">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Entidade</span>
                  <span className="font-bold text-foreground font-mono text-lg">{paymentEntity}</span>
                </div>
                <div className="border-t border-border" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Referência</span>
                  <span className="font-bold text-foreground font-mono text-sm">{paymentReference}</span>
                </div>
                <div className="border-t border-border" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valor</span>
                  <span className="font-bold text-primary font-mono">{paymentAmount.toLocaleString('pt-AO')} AOA</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-amber-700 text-xs">
                  ⏳ Pendente - Após o pagamento no Multicaixa Express ou PayPay África, o saldo será creditado automaticamente.
                </p>
              </div>

              <Button
                onClick={() => {
                  navigator.clipboard.writeText(`Entidade: ${paymentEntity}\nReferência: ${paymentReference}\nValor: ${paymentAmount} AOA`);
                  toast.success("Dados copiados!");
                }}
                variant="outline"
                className="w-full h-11 mb-2 border-border"
              >
                <Copy size={16} className="mr-2" />
                Copiar Dados
              </Button>
              
              <Button
                onClick={() => setShowPaymentInfo(false)}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                Fechar
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Wallet;
