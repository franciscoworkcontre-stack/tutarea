import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ workspace: string; project: string }>;
};

export default async function ProjectPage({ params }: Props) {
  const { workspace, project } = await params;
  redirect(`/app/${workspace}/projects/${project}/board`);
}
