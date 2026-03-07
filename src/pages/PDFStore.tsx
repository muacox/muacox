import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  ShoppingCart, 
  Plus, 
  X,
  Upload,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  CreditCard,
  Image as ImageIcon,
  AlertTriangle,
  User,
  Mail,
  Phone,
  Shield,
  Star,
  TrendingUp,
  BookOpen,
  Search,
  Filter,
  Copy,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";

interface PDFProduct {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number;
  file_url: string | null;
  cover_image_url: string | null;
  status: string;
  downloads_count: number;
  created_at: string;
}

interface PendingPurchase {
  transactionId: string;
  productId: string;
  productTitle: string;
  reference: string;
  entity: string;
  amount: number;
  status: string;
}

const ENTITY_CODE = "01055";

interface PaymentWebhookResponse {
  error?: string;
  already_purchased?: boolean;
  transaction_id?: string;
  reference?: string;
  entity?: string;
  status?: string;
  file_url?: string | null;
}

const PDFStore = () => {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<PDFProduct[]>([]);
  const [myProducts, setMyProducts] = useState<PDFProduct[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'loja' | 'meus'>('loja');
  const [loading, setLoading] = useState(true);
  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'price_low' | 'price_high'>('recent');
  
  // Purchase state
  const [showLoadingSplash, setShowLoadingSplash] = useState(false);
  const [showPurchaseInfo, setShowPurchaseInfo] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Checkout form state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState<PDFProduct | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  
  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProducts();
    if (user) {
      if (user.email) setClientEmail(user.email);
    }
    if (profile) {
      setClientName(profile.full_name || "");
      setClientPhone(profile.phone?.replace("+244", "") || "");
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, profile]);

  // Realtime listener for purchase status
  useEffect(() => {
    if (!pendingPurchase?.transactionId || !showPurchaseInfo || !user) return;

    const channel = supabase
      .channel(`purchase-status-${pendingPurchase.transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `id=eq.${pendingPurchase.transactionId}`,
        },
        async (payload) => {
          const status = (payload.new as { status?: string }).status;
          if (!status || (status !== 'completed' && status !== 'failed')) return;

          if (pollRef.current) clearInterval(pollRef.current);
          setPendingPurchase((prev) => (prev ? { ...prev, status } : null));

          if (status === 'completed') {
            toast.success("Pagamento confirmado! Baixando PDF...");
            const { data: statusData } = await supabase.functions.invoke('payment-webhook', {
              body: { action: 'purchase-status', transaction_id: pendingPurchase.transactionId }
            });
            const parsed = (statusData || {}) as PaymentWebhookResponse;
            if (parsed.file_url) {
              downloadPDF(parsed.file_url, pendingPurchase.productTitle);
            }
            fetchProducts();
          } else {
            toast.error("Pagamento expirado ou cancelado");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pendingPurchase?.transactionId, pendingPurchase?.productTitle, showPurchaseInfo, user]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data: approvedProducts } = await supabase
      .from('pdf_products')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (approvedProducts) setProducts(approvedProducts);

    if (user) {
      const { data: userProducts } = await supabase
        .from('pdf_products')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (userProducts) setMyProducts(userProducts);

      const { data: purchases } = await supabase
        .from('pdf_purchases')
        .select('product_id')
        .eq('user_id', user.id);
      if (purchases) setPurchasedIds(purchases.map(p => p.product_id));
    }
    setLoading(false);
  };

  const filteredProducts = products
    .filter(p => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular': return (b.downloads_count || 0) - (a.downloads_count || 0);
        case 'price_low': return a.price - b.price;
        case 'price_high': return b.price - a.price;
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const handleCreateProduct = async () => {
    if (!user || !profile) return;
    if (!title.trim() || !price || !pdfFile) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setUploading(true);
    try {
      const fileExt = pdfFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('pdf-products').upload(filePath, pdfFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('pdf-products').getPublicUrl(filePath);

      let coverUrl = null;
      if (coverImage) {
        const imgExt = coverImage.name.split('.').pop();
        const imgPath = `${user.id}/covers/${Date.now()}.${imgExt}`;
        const { error: imgError } = await supabase.storage.from('pdf-products').upload(imgPath, coverImage);
        if (!imgError) {
          const { data: imgUrlData } = supabase.storage.from('pdf-products').getPublicUrl(imgPath);
          coverUrl = imgUrlData.publicUrl;
        }
      }

      const { error } = await supabase.from('pdf_products').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        price: parseFloat(price),
        file_url: urlData.publicUrl,
        cover_image_url: coverUrl,
        status: 'pending'
      });
      if (error) throw error;

      toast.success("Infoproduto enviado para aprovação!");
      setShowCreateModal(false);
      setTitle(""); setDescription(""); setPrice(""); setPdfFile(null); setCoverImage(null);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar produto");
    } finally {
      setUploading(false);
    }
  };

  const handlePurchase = (product: PDFProduct) => {
    if (!user) { toast.error("Faça login para comprar"); return; }
    if (product.user_id === user.id) { toast.error("Você não pode comprar seu próprio produto"); return; }
    if (purchasedIds.includes(product.id)) {
      if (product.file_url) downloadPDF(product.file_url, product.title);
      return;
    }
    setCheckoutProduct(product);
    setShowCheckoutModal(true);
  };

  const handleCheckoutSubmit = async () => {
    if (!checkoutProduct || !user) return;
    if (!clientName.trim()) { toast.error("Nome completo é obrigatório"); return; }
    if (!clientEmail.trim() || !clientEmail.includes("@")) { toast.error("Email válido é obrigatório"); return; }
    if (!clientPhone.trim() || clientPhone.replace(/\D/g, "").length < 9) { toast.error("Número de telefone válido é obrigatório"); return; }

    setShowCheckoutModal(false);
    setShowLoadingSplash(true);

    try {
      const { data: resultData, error } = await supabase.functions.invoke('payment-webhook', {
        body: {
          action: 'purchase-pdf',
          product_id: checkoutProduct.id,
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          client_phone: clientPhone.replace(/\D/g, "")
        }
      });

      if (error) throw new Error(error.message || "Erro ao processar compra");
      const result = (resultData || {}) as PaymentWebhookResponse;

      if (result.error) {
        if (result.already_purchased && checkoutProduct.file_url) {
          downloadPDF(checkoutProduct.file_url, checkoutProduct.title);
          setShowLoadingSplash(false);
          return;
        }
        throw new Error(result.error);
      }
      if (!result.transaction_id || !result.reference) throw new Error("Não foi possível gerar referência de pagamento");

      setShowLoadingSplash(false);
      setPendingPurchase({
        transactionId: result.transaction_id,
        productId: checkoutProduct.id,
        productTitle: checkoutProduct.title,
        reference: result.reference,
        entity: result.entity || ENTITY_CODE,
        amount: checkoutProduct.price,
        status: "pending"
      });
      setShowPurchaseInfo(true);
      startPaymentPolling(result.transaction_id, checkoutProduct);
    } catch (error: any) {
      setShowLoadingSplash(false);
      toast.error(error.message || "Erro ao processar compra");
    }
  };

  const downloadPDF = async (url: string, title: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Arquivo indisponível");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success("Download iniciado!");
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const startPaymentPolling = (transactionId: string, product: PDFProduct) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      setCheckingPayment(true);
      try {
        const { data: resultData } = await supabase.functions.invoke('payment-webhook', {
          body: { action: 'purchase-status', transaction_id: transactionId }
        });
        const result = (resultData || {}) as PaymentWebhookResponse;
        if (result.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPendingPurchase(prev => prev ? { ...prev, status: "completed" } : null);
          toast.success("Pagamento confirmado!");
          if (result.file_url) setTimeout(() => downloadPDF(result.file_url!, product.title), 1000);
          fetchProducts();
        } else if (result.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPendingPurchase(prev => prev ? { ...prev, status: "failed" } : null);
          toast.error("Pagamento expirado ou cancelado");
        }
      } catch { /* retry */ } finally { setCheckingPayment(false); }
    }, 5000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Aprovado</span>;
      case 'pending': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">Em Análise</span>;
      case 'rejected': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">Rejeitado</span>;
      default: return null;
    }
  };

  const totalSales = myProducts.reduce((sum, p) => sum + (p.downloads_count || 0), 0);
  const totalRevenue = myProducts.reduce((sum, p) => sum + ((p.downloads_count || 0) * p.price * 0.85), 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Header */}
      <div className="relative overflow-hidden px-4 pt-6 pb-5">
        <div className="absolute inset-0 brand-gradient opacity-10" />
        <div className="absolute -top-20 -right-14 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-accent blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">Catálogo de Infoprodutores</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Venda e-books, guias e conteúdos digitais com checkout automático</p>
            </div>
            {user && (
              <Button
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="h-9 px-4"
              >
                <Plus size={16} className="mr-1.5" />
                Publicar
              </Button>
            )}
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card border border-border rounded-xl p-3 text-center">
              <BookOpen size={18} className="mx-auto text-primary mb-1" />
              <p className="text-lg font-bold text-foreground">{products.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Produtos</p>
            </div>
            <div className="glass-card border border-border rounded-xl p-3 text-center">
              <TrendingUp size={18} className="mx-auto text-success mb-1" />
              <p className="text-lg font-bold text-foreground">{totalSales}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vendas</p>
            </div>
            <div className="glass-card border border-border rounded-xl p-3 text-center">
              <Star size={18} className="mx-auto text-warning mb-1" />
              <p className="text-lg font-bold text-foreground">{myProducts.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Meus</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-4 py-3 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar infoprodutos..."
            className="pl-9 bg-card border-border h-10"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {([
            { key: 'recent', label: 'Recentes' },
            { key: 'popular', label: 'Populares' },
            { key: 'price_low', label: 'Menor Preço' },
            { key: 'price_high', label: 'Maior Preço' },
          ] as const).map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                sortBy === opt.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 mb-3">
        <div className="flex bg-secondary rounded-xl p-1 border border-border">
          <button
            onClick={() => setActiveTab('loja')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'loja' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Catálogo
          </button>
          <button
            onClick={() => setActiveTab('meus')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'meus' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Meus Infoprodutos
          </button>
        </div>
      </div>

      <div className="px-4">
        {activeTab === 'loja' ? (
          <div className="space-y-3">
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="aspect-[3/4] bg-secondary rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <BookOpen size={28} className="text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground mb-1">Nenhum infoproduto encontrado</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "Tente outra pesquisa" : "Seja o primeiro a publicar!"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((product, index) => {
                  const isOwner = user && product.user_id === user.id;
                  const isPurchased = purchasedIds.includes(product.id);
                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="group bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                    >
                      {/* Cover */}
                      <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-primary/10 to-accent/30">
                        {product.cover_image_url ? (
                          <img 
                            src={product.cover_image_url} 
                            alt={product.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="text-primary/40" size={40} />
                          </div>
                        )}
                        {/* Price Badge */}
                        <div className="absolute top-2 right-2 bg-foreground/80 backdrop-blur-sm text-background text-xs font-bold px-2.5 py-1 rounded-full">
                          {product.price.toLocaleString('pt-AO')} Kz
                        </div>
                        {isPurchased && (
                          <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle size={10} /> Comprado
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2 mb-1">
                          {product.title}
                        </h3>
                        {product.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
                            {product.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-2.5">
                          <Download size={11} />
                          <span className="text-[11px]">{product.downloads_count || 0} vendas</span>
                        </div>
                        
                        {isOwner ? (
                          <div className="text-[11px] text-center text-muted-foreground bg-secondary py-1.5 rounded-lg">
                            Seu infoproduto
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handlePurchase(product)}
                            className={`w-full text-xs h-8 shadow-sm ${
                              isPurchased 
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                            }`}
                          >
                            {isPurchased ? (
                              <><Download size={13} className="mr-1" /> Baixar PDF</>
                            ) : (
                              <><ShoppingCart size={13} className="mr-1" /> Comprar</>
                            )}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Meus Infoprodutos */
          <div className="space-y-3">
            {/* Revenue Card */}
            {myProducts.length > 0 && (
              <div className="bg-gradient-to-r from-primary to-orange-600 rounded-2xl p-4 text-white">
                <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Receita Total (85%)</p>
                <p className="text-2xl font-bold font-mono">{totalRevenue.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} AOA</p>
                <p className="text-white/60 text-xs mt-1">{totalSales} vendas realizadas</p>
              </div>
            )}

            {myProducts.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Plus size={28} className="text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground mb-1">Publique seu primeiro infoproduto</p>
                <p className="text-sm text-muted-foreground mb-4">Venda e-books e conteúdos digitais</p>
                <Button onClick={() => setShowCreateModal(true)} className="bg-primary text-primary-foreground">
                  <Plus size={16} className="mr-1.5" /> Publicar Agora
                </Button>
              </div>
            ) : (
              myProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card border border-border rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex gap-3">
                    <div className="w-14 h-18 rounded-xl flex-shrink-0 overflow-hidden bg-primary/10">
                      {product.cover_image_url ? (
                        <img src={product.cover_image_url} alt={product.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="text-primary/50" size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground text-sm truncate">{product.title}</h3>
                        {getStatusBadge(product.status)}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-primary text-sm">
                          {product.price.toLocaleString('pt-AO')} AOA
                        </span>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Eye size={12} />
                          <span className="text-xs">{product.downloads_count || 0} vendas</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      <BottomNavigation />

      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckoutModal && checkoutProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50 flex items-end justify-center p-4"
            onClick={() => setShowCheckoutModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-lg text-foreground">Checkout Seguro</h3>
                <button onClick={() => setShowCheckoutModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-secondary rounded-xl p-3 mb-4 flex gap-3 items-center">
                <div className="w-12 h-14 rounded-lg overflow-hidden bg-primary/10 flex-shrink-0">
                  {checkoutProduct.cover_image_url ? (
                    <img src={checkoutProduct.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><FileText className="text-primary/40" size={18} /></div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{checkoutProduct.title}</p>
                  <p className="text-lg font-bold text-primary">{checkoutProduct.price.toLocaleString('pt-AO')} AOA</p>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 flex items-start gap-2">
                <Shield size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground text-xs">
                  Pagamento por referência PlinqPay (Entidade {ENTITY_CODE}). Após pagamento, o download é liberado automaticamente.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <User size={14} /> Nome Completo
                  </Label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Seu nome completo" className="bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Mail size={14} /> Email
                  </Label>
                  <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="seu@email.com" className="bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Phone size={14} /> Telefone
                  </Label>
                  <Input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="923456789" className="bg-secondary border-border" />
                </div>
              </div>

              <Button
                onClick={handleCheckoutSubmit}
                disabled={!clientName || !clientEmail || !clientPhone}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 mt-4"
              >
                <CreditCard size={16} className="mr-2" />
                Gerar Referência de Pagamento
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Splash */}
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
            <p className="text-foreground font-semibold text-lg">Gerando referência...</p>
            <p className="text-muted-foreground text-sm mt-2">Aguarde um momento</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Product Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50 flex items-end justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-lg text-foreground">Publicar Infoproduto</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground block mb-1.5">Título do Infoproduto *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Guia Completo de Marketing Digital" className="bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground block mb-1.5">Descrição</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o conteúdo do seu infoproduto..." className="bg-secondary border-border resize-none" rows={3} />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground block mb-1.5">Preço (AOA) *</Label>
                  <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 1500" className="bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground block mb-1.5">Capa do Infoproduto</Label>
                  <label className="flex items-center justify-center gap-2 p-5 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-secondary/50">
                    <ImageIcon size={20} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{coverImage ? coverImage.name : 'Selecionar imagem de capa'}</span>
                    <input type="file" accept="image/*" onChange={(e) => setCoverImage(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground block mb-1.5">Arquivo PDF *</Label>
                  <label className="flex items-center justify-center gap-2 p-5 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-secondary/50">
                    <Upload size={20} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{pdfFile ? pdfFile.name : 'Selecionar arquivo PDF'}</span>
                    <input type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
                <div className="bg-accent border border-primary/10 rounded-xl p-3">
                  <p className="text-accent-foreground text-xs flex items-start gap-1.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>Seu infoproduto será analisado antes de ser publicado. Taxa de 15% por venda.</span>
                  </p>
                </div>
                <Button onClick={handleCreateProduct} disabled={uploading || !title || !price || !pdfFile} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20">
                  {uploading ? 'Enviando...' : 'Enviar para Aprovação'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Reference Modal */}
      <AnimatePresence>
        {showPurchaseInfo && pendingPurchase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-lg text-foreground">
                  {pendingPurchase.status === "completed" ? "Pagamento Confirmado" : 
                   pendingPurchase.status === "failed" ? "Pagamento Falhou" : "Aguardando Pagamento"}
                </h3>
                <button 
                  onClick={() => {
                    setShowPurchaseInfo(false);
                    setPendingPurchase(null);
                    if (pollRef.current) clearInterval(pollRef.current);
                  }}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="text-center space-y-4">
                {pendingPurchase.status === "pending" && (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Clock size={28} className="text-amber-600" />
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      Produto: <strong className="text-foreground">{pendingPurchase.productTitle}</strong>
                    </p>

                    <div className="bg-secondary rounded-2xl p-5 text-left space-y-4">
                      <div>
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Entidade</span>
                        <p className="font-mono font-bold text-foreground text-2xl">{pendingPurchase.entity}</p>
                      </div>
                      <div className="border-t border-border" />
                      <div>
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Referência</span>
                        <p className="font-mono font-bold text-foreground text-xl">{pendingPurchase.reference}</p>
                      </div>
                      <div className="border-t border-border" />
                      <div>
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Valor</span>
                        <p className="font-mono font-bold text-primary text-2xl">{pendingPurchase.amount.toLocaleString('pt-AO')} AOA</p>
                      </div>
                    </div>

                    <div className="bg-accent border border-primary/10 rounded-xl p-3">
                      <p className="text-accent-foreground text-xs">
                        {checkingPayment ? "Verificando pagamento..." : "Pague por referência no seu banco ou app de pagamento. A confirmação é automática."}
                      </p>
                    </div>

                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(`Entidade: ${pendingPurchase.entity}\nReferência: ${pendingPurchase.reference}\nValor: ${pendingPurchase.amount} AOA`);
                        toast.success("Dados copiados!");
                      }}
                      variant="outline"
                      className="w-full border-border"
                    >
                      <Copy size={16} className="mr-2" />
                      Copiar Dados de Pagamento
                    </Button>
                  </>
                )}

                {pendingPurchase.status === "completed" && (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle size={28} className="text-emerald-600" />
                    </div>
                    <h4 className="font-bold text-foreground text-lg">Pagamento Confirmado!</h4>
                    <p className="text-sm text-muted-foreground">Seu PDF está sendo baixado automaticamente</p>
                  </>
                )}

                {pendingPurchase.status === "failed" && (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                      <XCircle size={28} className="text-destructive" />
                    </div>
                    <h4 className="font-bold text-foreground text-lg">Pagamento Expirado</h4>
                    <p className="text-sm text-muted-foreground">A referência expirou ou foi cancelada. Tente novamente.</p>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PDFStore;
