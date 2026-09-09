import { NextRequest, NextResponse } from "next/server";
import { vqsExperimentService } from "@/lib/vqs-experiment-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create_experiment") {
      const exp = await vqsExperimentService.createExperiment({
        title: body.title,
        description: body.description,
        vqsVersion: body.vqsVersion,
        targetSampleSize: body.targetSampleSize,
      });
      return NextResponse.json(exp, { status: 201 });
    }

    if (action === "add_sample") {
      const sample = await vqsExperimentService.addSample({
        experimentId: body.experimentId,
        packId: body.packId,
        conceptId: body.conceptId,
        previewKey: body.previewKey,
        previewUrl: body.previewUrl,
        vqsScore: body.vqsScore,
        vqsReport: body.vqsReport,
        vqsVersion: body.vqsVersion,
      });
      return NextResponse.json(sample, { status: 201 });
    }

    if (action === "register_rater") {
      const rater = await vqsExperimentService.registerRater({
        experimentId: body.experimentId,
        pseudonym: body.pseudonym,
        experienceYears: body.experienceYears,
        isProfessionalDesigner: body.isProfessionalDesigner,
      });
      return NextResponse.json(rater, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to process experiment request" }, { status: 500 });
  }
}
