import urllib.request
import re

url = 'https://excelsheet101.github.io/nirmal-lamsal/'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('utf-8')
images = re.findall(r'<img[^>]+src=[\'"]([^\'"]+)[\'"]', html)
print("IMAGES FOUND:")
for img in images:
    print(img)
