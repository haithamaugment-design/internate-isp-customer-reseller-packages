import BlogPostContent from "./BlogPostContent";

export function generateStaticParams() {
  return [
    { slug: "setup-first-wifi-hotspot-netmaster" },
    { slug: "mikrotik-routeros-v7-beginner-guide" },
    { slug: "pricing-strategies-triple-reseller-revenue" },
    { slug: "secure-wifi-network-resellers-guide" },
  ];
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <BlogPostContent slug={slug} />;
}
