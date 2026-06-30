from faster_whisper import WhisperModel

model_size = "large-v3"

model = WhisperModel(model_size, device="cpu", compute_type="int8")

eva_segments, info = model.transcribe(language='nl', audio='recordings/interview_1.m4a', log_progress=True)
for segment in eva_segments:
    with open('transcription.txt', "a") as output_file:
        output_file.write(f"{segment.start}: {segment.text}\n")