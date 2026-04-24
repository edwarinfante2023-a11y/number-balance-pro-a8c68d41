export const getLotteryLogo = (name: string) => {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  if (lower.includes("anguilla") || lower.includes("anguila")) return "/lotteries/anguilla.png";
  if (lower.includes("florida")) return "/lotteries/florida.png";
  if (lower.includes("new york") || lower.includes("ny")) return "/lotteries/newyork.png";
  if (lower.includes("nacional")) return "/lotteries/nacional.png";
  if (lower.includes("real")) return "/lotteries/real.png";
  if (lower.includes("leidsa")) return "/lotteries/leidsa.png";
  if (lower.includes("loteka")) return "/lotteries/loteka.png";
  if (lower.includes("primera")) return "/lotteries/primera.png";
  if (lower.includes("suerte")) return "/lotteries/suerte.png";
  if (lower.includes("lotedom")) return "/lotteries/lotedom.png";
  if (lower.includes("king")) return "/lotteries/king.png";
  return undefined;
};
