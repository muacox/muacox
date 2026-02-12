import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";

const app = new Hono();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// PlinqPay API configuration
const PLINQPAY_API_URL = "https://api.plinqpay.com/v1/transaction";
const PLINQPAY_API_KEY = Deno.env.get("PLIQPAG_API_KEY")!;
const ENTITY_CODE = "01055";

const getCallbackUrl = () => {
  return `${supabaseUrl}/functions/v1/payment-webhook/plinqpay-callback`;
};

interface PlinqPayTransaction {
  externalId: string;
  callbackUrl: string;
  method: "REFERENCE" | "WALLET";
  client: {
    name: string;
    email: string;
    phone: string;
  };
  items: {
    title: string;
    price: number;
    quantity: number;
  }[];
  amount: number;
}

interface PlinqPayCallback {
  id: string;
  externalId: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";
  amount: number;
  reference?: string;
  paidAt?: string;
}

// CORS preflight
app.options("*", (c) => {
  return new Response(null, { headers: corsHeaders });
});

// PlinqPay webhook callback endpoint
app.post("/plinqpay-callback", async (c) => {
  try {
    const payload: PlinqPayCallback = await c.req.json();
    console.log("PlinqPay callback received:", JSON.stringify(payload));

    const { data: transaction, error: findError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", payload.externalId)
      .single();

    if (findError || !transaction) {
      console.error("Transaction not found:", findError);
      return c.json({ error: "Transaction not found" }, 404);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", transaction.user_id)
      .single();

    if (!profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    if (payload.status === "PAID") {
      await supabase
        .from("transactions")
        .update({ 
          status: "completed",
          description: `${transaction.description} - Pago PlinqPay: ${payload.id}`
        })
        .eq("id", transaction.id);

      if (transaction.type === "deposit") {
        const newBalance = (profile.balance || 0) + transaction.amount;
        await supabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("user_id", transaction.user_id);

        await supabase
          .from("notifications")
          .insert({
            user_id: transaction.user_id,
            type: "deposit",
            title: "Depósito Confirmado",
            message: `Seu depósito de ${transaction.amount.toLocaleString()} AOA foi confirmado!`
          });
      }

      // Handle PDF purchase payment
      if (transaction.type === "pdf_purchase") {
        const productId = transaction.description?.match(/product:(\S+)/)?.[1];
        if (productId) {
          // Record purchase
          await supabase.from("pdf_purchases").insert({
            user_id: transaction.user_id,
            product_id: productId,
            amount: transaction.amount
          });

          // Update downloads count
          const { data: product } = await supabase
            .from("pdf_products")
            .select("*")
            .eq("id", productId)
            .single();

          if (product) {
            await supabase.from("pdf_products")
              .update({ downloads_count: (product.downloads_count || 0) + 1 })
              .eq("id", productId);

            // Credit seller (85%)
            const { data: sellerProfile } = await supabase
              .from("profiles")
              .select("balance")
              .eq("user_id", product.user_id)
              .single();

            if (sellerProfile) {
              await supabase.from("profiles")
                .update({ balance: (sellerProfile.balance || 0) + product.price * 0.85 })
                .eq("user_id", product.user_id);
            }
          }

          await supabase
            .from("notifications")
            .insert({
              user_id: transaction.user_id,
              type: "pdf_purchase",
              title: "Compra Confirmada",
              message: `Seu pagamento foi confirmado! Pode baixar o PDF agora.`
            });
        }
      }

      return c.json({ success: true, message: "Payment confirmed" }, { headers: corsHeaders });
    } else if (payload.status === "EXPIRED" || payload.status === "CANCELLED") {
      await supabase
        .from("transactions")
        .update({ 
          status: "failed",
          description: `${transaction.description} - ${payload.status}`
        })
        .eq("id", transaction.id);

      if (transaction.type === "withdrawal") {
        const newBalance = (profile.balance || 0) + transaction.amount;
        await supabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("user_id", transaction.user_id);
      }

      return c.json({ success: true, message: "Payment cancelled/expired" }, { headers: corsHeaders });
    }

    return c.json({ success: true, message: "Webhook received" }, { headers: corsHeaders });
  } catch (error) {
    console.error("PlinqPay callback error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Initiate payment via PlinqPay
app.post("/initiate", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { type, amount, method, phone } = await c.req.json();

    if (!type || !amount || !phone) {
      return c.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return c.json({ error: "Profile not found" }, { status: 404, headers: corsHeaders });
    }

    // Validate withdrawal
    if (type === "withdrawal") {
      if (amount < 200) {
        return c.json({ error: "Valor mínimo de levantamento: 200 AOA" }, { status: 400, headers: corsHeaders });
      }
      if (amount > 200000) {
        return c.json({ error: "Valor máximo de levantamento: 200.000 AOA" }, { status: 400, headers: corsHeaders });
      }
      if ((profile.balance || 0) < amount) {
        return c.json({ error: "Saldo insuficiente" }, { status: 400, headers: corsHeaders });
      }

      // Deduct from balance immediately for withdrawal
      await supabase
        .from("profiles")
        .update({ balance: (profile.balance || 0) - amount })
        .eq("user_id", user.id);
    }

    // Validate deposit
    if (type === "deposit") {
      if (amount < 12) {
        return c.json({ error: "Valor mínimo de depósito: 12 AOA" }, { status: 400, headers: corsHeaders });
      }
      if (amount > 1000000) {
        return c.json({ error: "Valor máximo de depósito: 1.000.000 AOA" }, { status: 400, headers: corsHeaders });
      }
    }

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type,
        amount,
        status: "pending",
        method: "PlinqPay",
        description: `${type === "deposit" ? "Depósito" : "Levantamento"} via PlinqPay - ${phone}`
      })
      .select()
      .single();

    if (txError) throw txError;

    if (type === "deposit") {
      const plinqpayPayload: PlinqPayTransaction = {
        externalId: transaction.id,
        callbackUrl: getCallbackUrl(),
        method: "REFERENCE",
        client: {
          name: profile.full_name || "Cliente PayVendas",
          email: user.email || "cliente@payvendas.app",
          phone: phone.startsWith("+244") ? phone : `+244${phone}`
        },
        items: [
          {
            title: "Depósito PayVendas",
            price: amount,
            quantity: 1
          }
        ],
        amount: 1
      };

      console.log("Creating PlinqPay transaction:", JSON.stringify(plinqpayPayload));

      const plinqpayResponse = await fetch(PLINQPAY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': PLINQPAY_API_KEY
        },
        body: JSON.stringify(plinqpayPayload)
      });

      const plinqpayResult = await plinqpayResponse.json();
      console.log("PlinqPay response:", JSON.stringify(plinqpayResult));

      if (!plinqpayResponse.ok) {
        await supabase
          .from("transactions")
          .update({ status: "failed", description: `Erro PlinqPay: ${JSON.stringify(plinqpayResult)}` })
          .eq("id", transaction.id);

        return c.json({ 
          error: plinqpayResult.message || "Erro ao criar transação de pagamento" 
        }, { status: 400, headers: corsHeaders });
      }

      await supabase
        .from("transactions")
        .update({ 
          description: `${transaction.description} - Ref: ${plinqpayResult.reference || plinqpayResult.id}`
        })
        .eq("id", transaction.id);

      return c.json({
        success: true,
        transaction_id: transaction.id,
        plinqpay_id: plinqpayResult.id,
        reference: plinqpayResult.reference,
        entity: ENTITY_CODE,
        status: "pending",
        instructions: `Entidade: ${ENTITY_CODE}\nReferência: ${plinqpayResult.reference || plinqpayResult.id}\nValor: ${amount.toLocaleString()} AOA\n\nPague via Multicaixa Express ou PayPay África.`,
        message: "Siga as instruções para completar o depósito"
      }, { headers: corsHeaders });

    } else {
      // Withdrawals are manual - admin approves
      return c.json({
        success: true,
        transaction_id: transaction.id,
        status: "pending",
        instructions: `Seu levantamento de ${amount.toLocaleString()} AOA foi solicitado.\nSerá processado pelo administrador em até 24 horas úteis para o número ${phone}.`,
        message: "Seu levantamento está sendo processado"
      }, { headers: corsHeaders });
    }

  } catch (error) {
    console.error("Initiate payment error:", error);
    return c.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});

// PDF Purchase via PlinqPay
app.post("/purchase-pdf", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { product_id, phone } = await c.req.json();

    if (!product_id || !phone) {
      return c.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return c.json({ error: "Profile not found" }, { status: 404, headers: corsHeaders });
    }

    // Get product
    const { data: product } = await supabase
      .from("pdf_products")
      .select("*")
      .eq("id", product_id)
      .eq("status", "approved")
      .single();

    if (!product) {
      return c.json({ error: "Produto não encontrado" }, { status: 404, headers: corsHeaders });
    }

    // Check if already purchased
    const { data: existingPurchase } = await supabase
      .from("pdf_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", product_id)
      .single();

    if (existingPurchase) {
      return c.json({ error: "Você já comprou este produto", already_purchased: true }, { status: 400, headers: corsHeaders });
    }

    // Create transaction
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "pdf_purchase",
        amount: product.price,
        status: "pending",
        method: "PlinqPay",
        description: `Compra PDF: ${product.title} - product:${product.id}`
      })
      .select()
      .single();

    if (txError) throw txError;

    // Create PlinqPay transaction
    const plinqpayPayload: PlinqPayTransaction = {
      externalId: transaction.id,
      callbackUrl: getCallbackUrl(),
      method: "REFERENCE",
      client: {
        name: profile.full_name || "Cliente PayVendas",
        email: user.email || "cliente@payvendas.app",
        phone: phone.startsWith("+244") ? phone : `+244${phone}`
      },
      items: [
        {
          title: product.title,
          price: product.price,
          quantity: 1
        }
      ],
      amount: 1
    };

    const plinqpayResponse = await fetch(PLINQPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': PLINQPAY_API_KEY
      },
      body: JSON.stringify(plinqpayPayload)
    });

    const plinqpayResult = await plinqpayResponse.json();

    if (!plinqpayResponse.ok) {
      await supabase
        .from("transactions")
        .update({ status: "failed" })
        .eq("id", transaction.id);

      return c.json({ 
        error: plinqpayResult.message || "Erro ao criar pagamento" 
      }, { status: 400, headers: corsHeaders });
    }

    await supabase
      .from("transactions")
      .update({ 
        description: `${transaction.description} - Ref: ${plinqpayResult.reference || plinqpayResult.id}`
      })
      .eq("id", transaction.id);

    return c.json({
      success: true,
      transaction_id: transaction.id,
      reference: plinqpayResult.reference,
      entity: ENTITY_CODE,
      status: "pending",
      product_title: product.title,
      amount: product.price,
      instructions: `Entidade: ${ENTITY_CODE}\nReferência: ${plinqpayResult.reference || plinqpayResult.id}\nValor: ${product.price.toLocaleString()} AOA\n\nPague via Multicaixa Express ou PayPay África.`
    }, { headers: corsHeaders });

  } catch (error) {
    console.error("Purchase PDF error:", error);
    return c.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});

// Check purchase status and get download URL
app.get("/purchase-status/:transactionId", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }

    const transactionId = c.req.param("transactionId");
    
    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .single();

    if (!transaction) {
      return c.json({ error: "Transaction not found" }, { status: 404, headers: corsHeaders });
    }

    const productId = transaction.description?.match(/product:(\S+)/)?.[1];
    let fileUrl = null;

    if (transaction.status === "completed" && productId) {
      const { data: product } = await supabase
        .from("pdf_products")
        .select("file_url, title")
        .eq("id", productId)
        .single();
      
      if (product) {
        fileUrl = product.file_url;
      }
    }

    return c.json({
      status: transaction.status,
      file_url: fileUrl,
      amount: transaction.amount
    }, { headers: corsHeaders });

  } catch (error) {
    console.error("Purchase status error:", error);
    return c.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});

// Admin endpoint to process transactions (approve/reject withdrawals)
app.post("/admin/process", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }

    const { data: isAdmin } = await supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" });

    if (!isAdmin) {
      return c.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }

    const { transaction_id, action } = await c.req.json();

    if (!transaction_id || !action) {
      return c.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .single();

    if (!transaction) {
      return c.json({ error: "Transaction not found" }, { status: 404, headers: corsHeaders });
    }

    if (action === "approve") {
      await supabase
        .from("transactions")
        .update({ status: "completed" })
        .eq("id", transaction_id);

      if (transaction.type === "deposit") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("user_id", transaction.user_id)
          .single();

        await supabase
          .from("profiles")
          .update({ balance: (profile?.balance || 0) + transaction.amount })
          .eq("user_id", transaction.user_id);
      }

      await supabase
        .from("notifications")
        .insert({
          user_id: transaction.user_id,
          type: transaction.type,
          title: transaction.type === "deposit" ? "Depósito Aprovado" : "Levantamento Aprovado",
          message: `Sua transação de ${transaction.amount.toLocaleString()} AOA foi aprovada!`
        });

    } else if (action === "reject") {
      await supabase
        .from("transactions")
        .update({ status: "failed" })
        .eq("id", transaction_id);

      if (transaction.type === "withdrawal") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("user_id", transaction.user_id)
          .single();

        await supabase
          .from("profiles")
          .update({ balance: (profile?.balance || 0) + transaction.amount })
          .eq("user_id", transaction.user_id);
      }

      await supabase
        .from("notifications")
        .insert({
          user_id: transaction.user_id,
          type: transaction.type,
          title: "Transação Rejeitada",
          message: `Sua transação de ${transaction.amount.toLocaleString()} AOA foi rejeitada.`
        });
    }

    return c.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("Admin process error:", error);
    return c.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});

// Check transaction status
app.get("/status/:id", async (c) => {
  try {
    const transactionId = c.req.param("id");
    
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("id, status, amount, type, method, created_at, description")
      .eq("id", transactionId)
      .single();

    if (error || !transaction) {
      return c.json({ error: "Transaction not found" }, { status: 404, headers: corsHeaders });
    }

    return c.json(transaction, { headers: corsHeaders });
  } catch (error) {
    console.error("Status check error:", error);
    return c.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});

export default app;
