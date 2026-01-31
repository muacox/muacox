import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wallet, 
  AlertTriangle,
  Play,
  Pause,
  TrendingUp,
  TrendingDown,
  Share2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TradingChart } from "@/components/trading/TradingChart";
import { useAuth } from "@/hooks/useAuth";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import payvendasLogo from "@/assets/payvendas-logo.png";

const Trading = () => {
  const { user, profile } = useAuth();
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [demoBalance, setDemoBalance] = useState(10000);
  const [showPostPrompt, setShowPostPrompt] = useState(false);
  const [lastTradeResult, setLastTradeResult] = useState<{ isWin: boolean; amount: number; pair: string } | null>(null);
  const [postContent, setPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const currentBalance = isDemoMode ? demoBalance : (profile?.balance || 0);

  const handleTradeComplete = (isWin: boolean, amount: number, pair: string) => {
    // Only prompt for real trades
    if (!isDemoMode && user && profile?.kyc_status === 'approved') {
      setLastTradeResult({ isWin, amount, pair });
      setPostContent(isWin 
        ? `Acabei de lucrar ${amount.toLocaleString('pt-AO')} AOA em ${pair}! 🚀💰`
        : `Perdi ${amount.toLocaleString('pt-AO')} AOA em ${pair} 📉 Faz parte do jogo!`
      );
      setShowPostPrompt(true);
    }
  };

  const handlePublishResult = async () => {
    if (!user || !lastTradeResult) return;

    setIsPosting(true);

    const { error } = await supabase
      .from('feed_posts')
      .insert({
        user_id: user.id,
        content: postContent,
        profit_amount: lastTradeResult.amount,
        is_profit: lastTradeResult.isWin
      });

    if (error) {
      toast.error("Erro ao publicar");
    } else {
      toast.success("Resultado publicado no feed!");
    }

    setIsPosting(false);
    setShowPostPrompt(false);
    setLastTradeResult(null);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-border shadow-sm">
        <div className="flex items-center gap-3">
          <img src={payvendasLogo} alt="PayVendas" className="h-8" />
        </div>
        
        <div className="flex items-center gap-3">
          {/* Balance */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg border border-border">
            <Wallet className="text-primary" size={16} />
            <span className="font-mono font-bold text-foreground text-sm">
              {currentBalance.toLocaleString('pt-AO')}
            </span>
            <span className="text-muted-foreground text-xs">AOA</span>
          </div>
          
          {/* Mode Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDemoMode(!isDemoMode)}
            className={`h-8 px-3 text-xs font-bold ${
              isDemoMode 
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }`}
          >
            {isDemoMode ? (
              <>
                <Play size={12} className="mr-1" />
                DEMO
              </>
            ) : (
              <>
                <Pause size={12} className="mr-1" />
                REAL
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Risk Warning */}
      <div className="px-3 py-1.5 bg-red-50 border-b border-red-100">
        <div className="flex items-center justify-center gap-2">
          <AlertTriangle className="text-red-500" size={12} />
          <p className="text-[10px] text-red-600">
            <span className="font-semibold">RISCO:</span> O mercado financeiro envolve riscos. Conteúdo educativo.
          </p>
        </div>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-3 py-1 bg-amber-50 border-b border-amber-100"
        >
          <p className="text-[10px] text-center text-amber-700">
            Modo Demo - Pratique sem risco com dinheiro virtual
          </p>
        </motion.div>
      )}

      {/* Trading Chart */}
      <div className="flex-1 pb-16 bg-foreground/5">
        <TradingChart 
          isDemoMode={isDemoMode} 
          balance={currentBalance}
          onBalanceChange={(newBalance) => {
            if (isDemoMode) {
              setDemoBalance(newBalance);
            }
          }}
          onTradeComplete={handleTradeComplete}
        />
      </div>

      {/* Post Result Modal */}
      <AnimatePresence>
        {showPostPrompt && lastTradeResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-border rounded-2xl w-full max-w-md p-5 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground text-lg">Compartilhar Resultado</h3>
                <button 
                  onClick={() => setShowPostPrompt(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Result Badge */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-4 ${
                lastTradeResult.isWin 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {lastTradeResult.isWin ? (
                  <TrendingUp size={18} />
                ) : (
                  <TrendingDown size={18} />
                )}
                <span className="font-bold">
                  {lastTradeResult.isWin ? '+' : '-'}{lastTradeResult.amount.toLocaleString('pt-AO')} AOA
                </span>
                <span className="text-sm opacity-80">em {lastTradeResult.pair}</span>
              </div>

              <Textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Escreva algo sobre sua operação..."
                className="mb-4 bg-secondary border-border text-foreground"
                rows={3}
              />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPostPrompt(false)}
                  className="flex-1 border-border text-muted-foreground"
                >
                  Não, obrigado
                </Button>
                <Button
                  onClick={handlePublishResult}
                  disabled={isPosting}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white shadow-md"
                >
                  <Share2 size={16} className="mr-2" />
                  Publicar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNavigation />
    </div>
  );
};

export default Trading;
