rm -f segments/*.ts
rm -f segments/*.m3u8

ffmpeg -y -format_code Hp25 -f decklink -i 'DeckLink SDI' \
  -pix_fmt yuv420p -s 640x360 -r 30000/1001 -c:v libx264 -b:v 736k -g 30 \
  -c:a aac -b:a 64k \
  -hls_time 1 -hls_playlist_type vod -hls_segment_filename segments/seg_%04d.ts \
  segments/demo.m3u8

# What I'd like to do is send the transport stream to a UPD socket instead of to a file.
# ffmpeg -y -format_code Hp25 -f decklink -i 'DeckLink SDI' \
#   -pix_fmt yuv420p -s 640x360 -r 30000/1001 -c:v libx264 -b:v 736k -g 30 \
#   -c:a aac -b:a 64k \
#   -f mpegts udp://127.0.0.1:1234
