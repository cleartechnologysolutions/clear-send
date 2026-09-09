import { FileSend } from "../file-send";

export default async function SendPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <FileSend initialSlug={slug} />;
}
