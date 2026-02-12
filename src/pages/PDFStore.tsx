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
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const PDFStore = () => {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<PDFProduct[]>([]);
  const [myProducts, setMyProducts] = useState<PDFProduct[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'loja' | 'meus' | 'compras'>('loja');
  const [loading, setLoading] = useState(true);
  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  
  // Purchase modal
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PDFProduct | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [processing, setProcessing] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProducts();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user]);

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

      // Fetch purchased product IDs
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
      // Upload PDF file
      const fileExt = pdfFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('pdf-products')
        .upload(filePath, pdfFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('pdf-products')
        .getPublicUrl(filePath);

      // Upload cover image if provided
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

  const handlePurchase = (product: PDFProduct) => {
    if (!user) {
      toast.error("Faça login para comprar");
      return;
    }

    if (purchasedIds.includes(product.id)) {
      // Already purchased, download directly
      if (product.file_url) {
        downloadPDF(product.file_url, product.title);
      }
      return;
    }

    setSelectedProduct(product);
    setShowPurchaseModal(true);
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

  const initiatePurchase = async () => {
    if (!selectedProduct || !phoneNumber || phoneNumber.length < 9) {
      toast.error("Insira um número de telefone válido");
      return;
    }

    setProcessing(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/payment-webhook/purchase-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token}`
        },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          phone: phoneNumber
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.already_purchased) {
          // Already purchased, just download
          if (selectedProduct.file_url) {
            downloadPDF(selectedProduct.file_url, selectedProduct.title);
          }
          setShowPurchaseModal(false);
          return;
        }
        throw new Error(result.error || "Erro ao processar compra");
      }

      setPendingPurchase({
        transactionId: result.transaction_id,
        productId: selectedProduct.id,
        productTitle: selectedProduct.title,
        reference: result.reference,
        entity: result.entity || ENTITY_CODE,
        amount: selectedProduct.price,
        status: "pending"
      });

      // Start polling for payment status
      startPaymentPolling(result.transaction_id);

    } catch (error: any) {
      toast.error(error.message || "Erro ao processar compra");
    } finally {
      setProcessing(false);
    }
  };

  const startPaymentPolling = (transactionId: string) => {
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
              downloadPDF(result.file_url, pendingPurchase?.productTitle || "documento");
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
              products.map((product, index) => (
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
                    </div>
                  </div>
                </motion.div>
              ))
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
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5">Título *</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nome do seu PDF"
                    className="bg-secondary border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5">Descrição</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva o conteúdo..."
                    className="bg-secondary border-border text-foreground resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5">Preço (AOA) *</label>
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex: 500"
                    className="bg-secondary border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5">Imagem de Capa</label>
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                    <ImageIcon size={20} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {coverImage ? coverImage.name : 'Selecionar imagem'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-1.5">Arquivo PDF *</label>
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload size={20} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {pdfFile ? pdfFile.name : 'Selecionar arquivo'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-amber-700 text-xs flex items-center gap-1">
                    <AlertTriangle size={14} />
                    Seu PDF será enviado para aprovação. 15% do valor de cada venda é retido como taxa.
                  </p>
                </div>

                <Button
                  onClick={handleCreateProduct}
                  disabled={uploading || !title || !price || !pdfFile}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md"
                >
                  {uploading ? 'Enviando...' : 'Enviar para Aprovação'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Modal */}
      <AnimatePresence>
        {showPurchaseModal && selectedProduct && (
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
                <h3 className="font-bold text-lg text-foreground">Comprar PDF</h3>
                <button 
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setPendingPurchase(null);
                    if (pollRef.current) clearInterval(pollRef.current);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>

              {!pendingPurchase ? (
                <>
                  {/* Product info */}
                  <div className="flex gap-3 mb-4 p-3 bg-secondary rounded-xl">
                    <div className="w-12 h-16 rounded-lg overflow-hidden bg-primary/10 flex-shrink-0">
                      {selectedProduct.cover_image_url ? (
                        <img src={selectedProduct.cover_image_url} alt={selectedProduct.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="text-primary" size={20} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">{selectedProduct.title}</h4>
                      <p className="text-primary font-bold mt-1">{selectedProduct.price.toLocaleString('pt-AO')} AOA</p>
                    </div>
                  </div>

                  {/* Payment method info */}
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard size={16} className="text-emerald-600" />
                      <span className="font-semibold text-emerald-700 text-sm">Pagamento por Referência</span>
                    </div>
                    <p className="text-emerald-600 text-xs">
                      Entidade: {ENTITY_CODE} - Pague via Multicaixa Express ou PayPay África
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="text-sm text-muted-foreground block mb-1.5">Número de telefone</label>
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="923 000 000"
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>

                  <Button
                    onClick={initiatePurchase}
                    disabled={processing}
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md"
                  >
                    {processing ? 'Processando...' : `Pagar ${selectedProduct.price.toLocaleString('pt-AO')} AOA`}
                  </Button>
                </>
              ) : (
                <>
                  {/* Payment pending/result */}
                  <div className="text-center space-y-4">
                    {pendingPurchase.status === "pending" && (
                      <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
                          <Clock size={28} className="text-amber-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground">Aguardando Pagamento</h4>
                          <p className="text-sm text-muted-foreground mt-1">Pague com os dados abaixo</p>
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

                        <p className="text-xs text-muted-foreground">
                          {checkingPayment ? "Verificando pagamento..." : "O sistema verificará automaticamente quando pagar"}
                        </p>
                      </>
                    )}

                    {pendingPurchase.status === "completed" && (
                      <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                          <CheckCircle size={28} className="text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground">Pago</h4>
                          <p className="text-sm text-muted-foreground">Seu PDF está sendo baixado</p>
                        </div>
                      </>
                    )}

                    {pendingPurchase.status === "failed" && (
                      <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                          <XCircle size={28} className="text-red-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground">Não Pago</h4>
                          <p className="text-sm text-muted-foreground">O pagamento expirou ou foi cancelado</p>
                        </div>
                      </>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPurchaseModal(false);
                        setPendingPurchase(null);
                        if (pollRef.current) clearInterval(pollRef.current);
                      }}
                      className="w-full"
                    >
                      Fechar
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PDFStore;
