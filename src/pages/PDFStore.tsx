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
  Shield
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
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

  const fetchProducts = async () => {
    setLoading(true);
    
    const { data: approvedProducts } = await supabase
      .from('pdf_products')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    
    if (approvedProducts) {
      setProducts(approvedProducts);
    }

    if (user) {
      const { data: userProducts } = await supabase
        .from('pdf_products')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (userProducts) {
        setMyProducts(userProducts);
      }

      const { data: purchases } = await supabase
        .from('pdf_purchases')
        .select('product_id')
        .eq('user_id', user.id);
      
      if (purchases) {
        setPurchasedIds(purchases.map(p => p.product_id));
      }
    }
    
    setLoading(false);
  };

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
      
      const { error: uploadError } = await supabase.storage
        .from('pdf-products')
        .upload(filePath, pdfFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('pdf-products')
        .getPublicUrl(filePath);

      let coverUrl = null;
      if (coverImage) {
        const imgExt = coverImage.name.split('.').pop();
        const imgPath = `${user.id}/covers/${Date.now()}.${imgExt}`;
        
        const { error: imgError } = await supabase.storage
          .from('pdf-products')
          .upload(imgPath, coverImage);

        if (!imgError) {
          const { data: imgUrlData } = supabase.storage
            .from('pdf-products')
            .getPublicUrl(imgPath);
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

      toast.success("PDF enviado para aprovação!");
      setShowCreateModal(false);
      setTitle("");
      setDescription("");
      setPrice("");
      setPdfFile(null);
      setCoverImage(null);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar produto");
    } finally {
      setUploading(false);
    }
  };

  const handlePurchase = async (product: PDFProduct) => {
    if (!user) {
      toast.error("Faça login para comprar");
      return;
    }

    // Block self-purchase
    if (product.user_id === user.id) {
      toast.error("Você não pode comprar seu próprio produto");
      return;
    }

    // Already purchased, download directly
    if (purchasedIds.includes(product.id)) {
      if (product.file_url) {
        downloadPDF(product.file_url, product.title);
      }
      return;
    }

    // Show checkout modal first
    setCheckoutProduct(product);
    setShowCheckoutModal(true);
  };

  const handleCheckoutSubmit = async () => {
    if (!checkoutProduct || !user) return;

    if (!clientName.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }
    if (!clientEmail.trim() || !clientEmail.includes("@")) {
      toast.error("Email válido é obrigatório");
      return;
    }
    if (!clientPhone.trim() || clientPhone.replace(/\D/g, "").length < 9) {
      toast.error("Número de telefone válido é obrigatório");
      return;
    }

    setShowCheckoutModal(false);
    setShowLoadingSplash(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const phoneFormatted = clientPhone.replace(/\D/g, "");
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/payment-webhook/purchase-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token}`
        },
        body: JSON.stringify({
          product_id: checkoutProduct.id,
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          client_phone: phoneFormatted
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.already_purchased) {
          if (checkoutProduct.file_url) {
            downloadPDF(checkoutProduct.file_url, checkoutProduct.title);
          }
          setShowLoadingSplash(false);
          return;
        }
        throw new Error(result.error || "Erro ao processar compra");
      }

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

      // Start polling for payment status
      startPaymentPolling(result.transaction_id, checkoutProduct);

    } catch (error: any) {
      setShowLoadingSplash(false);
      toast.error(error.message || "Erro ao processar compra");
    }
  };

  const downloadPDF = (url: string, title: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.pdf`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download iniciado!");
  };

  const startPaymentPolling = (transactionId: string, product: PDFProduct) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      setCheckingPayment(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const response = await fetch(`${SUPABASE_URL}/functions/v1/payment-webhook/purchase-status/${transactionId}`, {
          headers: {
            'Authorization': `Bearer ${session?.session?.access_token}`
          }
        });

        const result = await response.json();

        if (result.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPendingPurchase(prev => prev ? { ...prev, status: "completed" } : null);
          toast.success("Pagamento confirmado! Baixando PDF...");
          
          if (result.file_url) {
            setTimeout(() => {
              downloadPDF(result.file_url, product.title);
            }, 1000);
          }
          
          fetchProducts();
        } else if (result.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPendingPurchase(prev => prev ? { ...prev, status: "failed" } : null);
          toast.error("Pagamento expirado ou cancelado");
        }
      } catch (error) {
        console.error("Poll error:", error);
      } finally {
        setCheckingPayment(false);
      }
    }, 5000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-600">Aprovado</span>;
      case 'pending':
        return <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-600">Pendente</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-600">Rejeitado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-white border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground mb-1">Loja de PDFs</h1>
            <p className="text-muted-foreground text-sm">Compre e venda conteúdo educativo</p>
          </div>
          {user && (
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary/90 text-white shadow-md"
            >
              <Plus size={16} className="mr-1" />
              Publicar
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 py-4">
        <div className="flex bg-secondary rounded-xl p-1 border border-border">
          <button
            onClick={() => setActiveTab('loja')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'loja' 
                ? 'bg-primary text-white' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Loja
          </button>
          <button
            onClick={() => setActiveTab('meus')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'meus' 
                ? 'bg-primary text-white' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Meus PDFs
          </button>
        </div>
      </div>

      <div className="px-4">
        {activeTab === 'loja' ? (
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText size={40} className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhum produto disponível</p>
              </div>
            ) : (
              products.map((product, index) => {
                const isOwner = user && product.user_id === user.id;
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white border border-border rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex gap-4">
                      <div className="w-16 h-20 rounded-lg flex-shrink-0 overflow-hidden bg-primary/10">
                        {product.cover_image_url ? (
                          <img src={product.cover_image_url} alt={product.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="text-primary" size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm truncate">{product.title}</h3>
                        {product.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Download size={12} className="text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{product.downloads_count || 0} downloads</span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end justify-between">
                        <span className="font-bold text-primary">
                          {product.price.toLocaleString('pt-AO')} AOA
                        </span>
                        {isOwner ? (
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">Seu produto</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handlePurchase(product)}
                            className="bg-primary hover:bg-primary/90 text-white text-xs h-8 shadow-md"
                          >
                            {purchasedIds.includes(product.id) ? (
                              <>
                                <Download size={14} className="mr-1" />
                                Baixar
                              </>
                            ) : (
                              <>
                                <ShoppingCart size={14} className="mr-1" />
                                Comprar
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {myProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText size={40} className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">Você ainda não publicou nenhum PDF</p>
              </div>
            ) : (
              myProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white border border-border rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground text-sm">{product.title}</h3>
                    {getStatusBadge(product.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      {product.price.toLocaleString('pt-AO')} AOA
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {product.downloads_count || 0} vendas
                    </span>
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4"
            onClick={() => setShowCheckoutModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-border rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-foreground">Checkout</h3>
                <button onClick={() => setShowCheckoutModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-secondary rounded-xl p-3 mb-4">
                <p className="text-sm font-semibold text-foreground">{checkoutProduct.title}</p>
                <p className="text-lg font-bold text-primary">{checkoutProduct.price.toLocaleString('pt-AO')} AOA</p>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={16} className="text-primary" />
                  <span className="font-semibold text-foreground text-sm">Checkout Seguro</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Preencha seus dados para gerar a referência de pagamento.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <User size={14} /> Nome Completo *
                  </Label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Seu nome completo" className="bg-secondary border-border text-foreground" />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Mail size={14} /> Email *
                  </Label>
                  <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="seu@email.com" className="bg-secondary border-border text-foreground" />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Phone size={14} /> Número de Telefone *
                  </Label>
                  <Input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="923456789" className="bg-secondary border-border text-foreground" />
                </div>
              </div>

              <Button
                onClick={handleCheckoutSubmit}
                disabled={!clientName || !clientEmail || !clientPhone}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md mt-4"
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
            <p className="text-muted-foreground text-sm mt-2">Aguarde um momento...</p>
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-border rounded-2xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-foreground">Publicar PDF</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5">Título *</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do seu PDF" className="bg-secondary border-border text-foreground" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5">Descrição</label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o conteúdo..." className="bg-secondary border-border text-foreground resize-none" rows={3} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5">Preço (AOA) *</label>
                  <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 500" className="bg-secondary border-border text-foreground" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5">Imagem de Capa</label>
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                    <ImageIcon size={20} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{coverImage ? coverImage.name : 'Selecionar imagem'}</span>
                    <input type="file" accept="image/*" onChange={(e) => setCoverImage(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5">Arquivo PDF *</label>
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload size={20} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{pdfFile ? pdfFile.name : 'Selecionar arquivo'}</span>
                    <input type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-amber-700 text-xs flex items-center gap-1">
                    <AlertTriangle size={14} />
                    Seu PDF será enviado para aprovação. 15% do valor de cada venda é retido como taxa.
                  </p>
                </div>
                <Button onClick={handleCreateProduct} disabled={uploading || !title || !price || !pdfFile} className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md">
                  {uploading ? 'Enviando...' : 'Enviar para Aprovação'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Reference Modal - shows entity + reference directly */}
      <AnimatePresence>
        {showPurchaseInfo && pendingPurchase && (
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
              className="bg-white border border-border rounded-2xl w-full max-w-md p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg text-foreground">
                  {pendingPurchase.status === "completed" ? "Pago!" : 
                   pendingPurchase.status === "failed" ? "Não Pago" : "Aguardando Pagamento"}
                </h3>
                <button 
                  onClick={() => {
                    setShowPurchaseInfo(false);
                    setPendingPurchase(null);
                    if (pollRef.current) clearInterval(pollRef.current);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="text-center space-y-4">
                {pendingPurchase.status === "pending" && (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
                      <Clock size={28} className="text-amber-600" />
                    </div>
                    
                    <div className="text-left">
                      <p className="text-sm text-muted-foreground mb-2">Produto: <strong className="text-foreground">{pendingPurchase.productTitle}</strong></p>
                    </div>

                    <div className="bg-secondary rounded-xl p-4 text-left space-y-3">
                      <div>
                        <span className="text-xs text-muted-foreground">Entidade</span>
                        <p className="font-mono font-bold text-foreground text-lg">{pendingPurchase.entity}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Referência</span>
                        <p className="font-mono font-bold text-foreground text-lg">{pendingPurchase.reference}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Valor</span>
                        <p className="font-mono font-bold text-primary text-lg">{pendingPurchase.amount.toLocaleString('pt-AO')} AOA</p>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-amber-700 text-xs">
                        {checkingPayment ? "⏳ Verificando pagamento..." : "⏳ Pague via Multicaixa Express ou PayPay África. O sistema verificará automaticamente."}
                      </p>
                    </div>

                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(`Entidade: ${pendingPurchase.entity}\nReferência: ${pendingPurchase.reference}\nValor: ${pendingPurchase.amount} AOA`);
                        toast.success("Dados copiados!");
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Copiar Dados
                    </Button>
                  </>
                )}

                {pendingPurchase.status === "completed" && (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle size={28} className="text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">Pagamento Confirmado!</h4>
                      <p className="text-sm text-muted-foreground">Seu PDF está sendo baixado automaticamente</p>
                    </div>
                  </>
                )}

                {pendingPurchase.status === "failed" && (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                      <XCircle size={28} className="text-red-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">Pagamento Expirado</h4>
                      <p className="text-sm text-muted-foreground">O pagamento expirou ou foi cancelado</p>
                    </div>
                  </>
                )}

                <Button
                  onClick={() => {
                    setShowPurchaseInfo(false);
                    setPendingPurchase(null);
                    if (pollRef.current) clearInterval(pollRef.current);
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  Fechar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PDFStore;
