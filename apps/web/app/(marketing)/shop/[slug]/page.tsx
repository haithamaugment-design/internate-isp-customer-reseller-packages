import ProductContent from "./ProductContent";

export function generateStaticParams() {
  return [
    { slug: "mikrotik-hex-lite-rb750gr3" },
    { slug: "mikrotik-hex-refresh-rb760igs" },
    { slug: "mikrotik-rb4011" },
    { slug: "mikrotik-rb5009" },
  ];
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProductContent slug={slug} />;
}
