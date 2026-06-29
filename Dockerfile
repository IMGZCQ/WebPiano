FROM golang:1.26-alpine AS builder

WORKDIR /build

COPY go.mod ./
COPY main.go ./
COPY internal ./internal
COPY static ./static

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o webpiano main.go

FROM alpine:latest
WORKDIR /app

COPY --from=builder /build/webpiano ./
COPY --from=builder /build/static ./static

RUN apk add --no-cache ca-certificates tzdata

EXPOSE 9177
CMD ["./webpiano"]
