FROM node:24.5.0-slim AS builder

RUN apt-get update && apt-get install -y python3 python3-pip sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /home/bokari

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

COPY tsconfig.json next.config.mjs next-env.d.ts postcss.config.js drizzle.config.ts tailwind.config.ts ./
COPY src ./src
COPY public ./public
COPY drizzle ./drizzle

RUN mkdir -p /home/bokari/data

# Next.js inlines NEXT_PUBLIC_* into the BROWSER bundle at build time, so they
# must be present HERE (not just at runtime). On Dokploy, set these as
# "Build-time Variables"; with plain Docker pass them via --build-arg.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VERSION
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_VERSION=${NEXT_PUBLIC_VERSION}
# Throwaway value so env-validating route modules (discover/refresh, setup, …)
# don't throw during `next build`'s page-data collection. The REAL key is
# supplied at runtime via --env-file; this builder stage is discarded, so
# nothing leaks into the final image.
ENV SUPABASE_SERVICE_ROLE_KEY=build-time-placeholder

RUN yarn build

FROM node:24.5.0-slim

RUN apt-get update && apt-get install -y \
    python3-dev python3-babel python3-venv python-is-python3 \
    uwsgi uwsgi-plugin-python3 \
    git build-essential libxslt-dev zlib1g-dev libffi-dev libssl-dev \
    curl sudo \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/bokari

COPY --from=builder /home/bokari/public ./public
COPY --from=builder /home/bokari/.next/static ./public/_next/static
COPY --from=builder /home/bokari/.next/standalone ./
COPY --from=builder /home/bokari/data ./data
COPY drizzle ./drizzle

RUN mkdir /home/bokari/uploads

RUN useradd --shell /bin/bash --system \
    --home-dir "/usr/local/searxng" \
    --comment 'Privacy-respecting metasearch engine' \
    searxng

RUN mkdir "/usr/local/searxng"
RUN mkdir -p /etc/searxng
RUN chown -R "searxng:searxng" "/usr/local/searxng"

COPY searxng/settings.yml /etc/searxng/settings.yml
COPY searxng/limiter.toml /etc/searxng/limiter.toml
COPY searxng/uwsgi.ini /etc/searxng/uwsgi.ini
RUN chown -R searxng:searxng /etc/searxng

USER searxng

RUN git clone "https://github.com/searxng/searxng" \
                   "/usr/local/searxng/searxng-src"

RUN python3 -m venv "/usr/local/searxng/searx-pyenv"
RUN "/usr/local/searxng/searx-pyenv/bin/pip" install --upgrade pip setuptools wheel pyyaml msgspec
RUN cd "/usr/local/searxng/searxng-src" && \
    "/usr/local/searxng/searx-pyenv/bin/pip" install --use-pep517 --no-build-isolation -e .

USER root

WORKDIR /home/bokari
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh || true

RUN echo "searxng ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

EXPOSE 3000 8080

ENV SEARXNG_API_URL=http://localhost:8080

CMD ["/home/bokari/entrypoint.sh"]
