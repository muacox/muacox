export const SITE = {
  name: "MuacoX",
  tagline: "Criamos história que inovam",
  description: "Sites profissionais, hospedagem e flyers premium em Angola.",
  founder: "Isaac Muaco",
  email: "isaacmuaco528@gmail.com",
  phone: "+244 943 443 400",
  phoneRaw: "244943443400",
  whatsapp: "https://wa.me/244943443400",
  address: "Luanda, Angola",
  copyright: "© 2026/2027 MuacoX — Todos os direitos reservados.",
};

export const formatKz = (n: number) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(n);
