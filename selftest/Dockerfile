# The image selftest-build-image.yml builds through build-multiarch-image.yml.
# Its only job is to say which architecture it was built on, so that the
# smoke job can run the pushed index on each pool and compare.
FROM alpine:3.20
RUN uname -m > /machine
CMD ["cat", "/machine"]
