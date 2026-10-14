import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CoinProductPage from "../../../components/coin-product-page";
import { fetchCoinPage } from "../../../lib/coin-page";

type CoinPageProps = { params: Promise<{ mint: string }> };

export async function generateMetadata({ params }: CoinPageProps): Promise<Metadata> {
  const { mint } = await params;
  const data = await fetchCoinPage(mint);
  if (!data) return { title: "Coin not found | Bluebuild" };
  const { launch, pitch } = data;
  const title = `${launch.name} ($${launch.symbol}) | Bluebuild`;
  const description = pitch?.copy?.tagline || pitch?.description || launch.description || `${launch.name} on Bluebuild`;
  const image = pitch?.images?.[0]?.url || launch.image_url;
  return {
    title,
    description,
    openGraph: { title, description, images: image ? [{ url: image }] : undefined, type: "website" },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function CoinPage({ params }: CoinPageProps) {
  const { mint } = await params;
  const data = await fetchCoinPage(mint);
  if (!data) notFound();
  return <CoinProductPage launch={data.launch} pitch={data.pitch} />;
}
