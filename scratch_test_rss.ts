const SLOTS = [
  "8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "8pm", "9pm", "10pm"
];

function extractFirstPrize(title: string): number | null {
  const match = title.match(/:\s*(\d{1,2})-\d{1,2}-\d{1,2}/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function parseRSSItems(xml: string) {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1];
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
    if (titleMatch) {
      items.push({ title: titleMatch[1].trim() });
    }
  }
  return items;
}

async function testFetch() {
  for (const slug of SLOTS) {
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://enloteria.com/rss/anguilla-${slug}`)}`;
      const req = await fetch(proxyUrl);
      const xml = await req.text();
      const items = parseRSSItems(xml);
      
      console.log(`\nSlot: ${slug} (${items.length} items parsed)`);
      let successCount = 0;
      items.forEach((item, i) => {
        const prize = extractFirstPrize(item.title);
        if (prize !== null) successCount++;
        if (i < 2 && prize === null) {
          console.log(`  FAIL to parse: "${item.title}"`);
        }
      });
      console.log(`  Successfully extracted prizes for ${successCount} out of ${items.length}`);
    } catch (e) {
      console.error(`Error on ${slug}:`, e);
    }
  }
}

testFetch();
